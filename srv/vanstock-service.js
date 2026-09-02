const cds = require("@sap/cds");
const ExcelJS = require('exceljs');
const { loadLookups, validateRow } = require('./lib/validation');

module.exports = cds.service.impl(function () {
    const { VanStockProfile, UploadLog } = this.entities;

    // ============================
    // Step 1: Upload + Validate ONLY — no insert into VanStockProfile
    // ============================
    this.on('uploadProfile', (req) => {
        const { file } = req.data;

        if (!file) {
            req.error(400, "No file provided");
            return Promise.resolve();
        }

        const buffer = Buffer.from(file, 'base64');
        const workbook = new ExcelJS.Workbook();

        return workbook.xlsx.load(buffer)
            .catch(() => {
                req.error(400, "Could not read the Excel file. Please check the file format.");
                return Promise.reject(new Error("FILE_READ_FAILED"));
            })
            .then(() => {
                const worksheet = workbook.worksheets[0];

                if (!worksheet) {
                    req.error(400, 'Excel file does not contain any worksheet');
                    return Promise.reject(new Error("NO_WORKSHEET"));
                }
                // Build a map of header name -> column index from row 1
                const oColumnMap = {};
                const headerRow = worksheet.getRow(1);
                headerRow.eachCell((cell, colNumber) => {
                    oColumnMap[String(cell.value).trim()] = colNumber;
                });
                const aRawRows = [];

                worksheet.eachRow((row, rowNumber) => {
                    if (rowNumber === 1) {
                        return;
                    }

                    const engineerId = row.getCell(oColumnMap['engineerId'])?.value;
                    const profitCenter = row.getCell(oColumnMap['profitCenter'])?.value;
                    const partNumber = row.getCell(oColumnMap['partNumber'])?.value;
                    const quantity = row.getCell(oColumnMap['quantity'])?.value;
                    const value = row.getCell(oColumnMap['value'])?.value;

                    if (!engineerId && !profitCenter && !partNumber && !quantity && !value) {
                        return;
                    }

                    aRawRows.push({ rowNumber, engineerId, profitCenter, partNumber, quantity, value });
                });

                if (aRawRows.length === 0) {
                    req.error(400, 'Excel file does not contain any data rows');
                    return Promise.reject(new Error("NO_DATA_ROWS"));
                }

                return aRawRows;
            })
            .then((aRawRows) => {
                return loadLookups().then((oLookups) => {
                    const aLogEntries = [];
                    const sUploadedBy = req.user ? req.user.id : 'unknown';
                    const dUploadedOn = new Date();

                    aRawRows.forEach((oRawRow) => {
                        const oResult = validateRow(oRawRow, oLookups);

                        aLogEntries.push({
                            ID: cds.utils.uuid(),
                            uploadedOn: dUploadedOn,
                            uploadedBy: sUploadedBy,
                            rowNumber: oRawRow.rowNumber,
                            engineerId: oRawRow.engineerId ? String(oRawRow.engineerId) : null,
                            profitCenter: oRawRow.profitCenter ? String(oRawRow.profitCenter) : null,
                            partNumber: oRawRow.partNumber ? String(oRawRow.partNumber) : null,
                            quantity: isNaN(Number(oRawRow.quantity)) ? null : Number(oRawRow.quantity),
                            value: isNaN(Number(oRawRow.value)) ? null : Number(oRawRow.value),
                            status: oResult.isValid ? 'Success' : 'Failed',
                            remark: oResult.isValid ? '' : oResult.errors.join('; '),
                            posted: false
                        });
                    });

                    return aLogEntries;
                });
            })
            .then((aLogEntries) => {
                return INSERT.into(UploadLog).entries(aLogEntries).then(() => {
                    const iSuccessCount = aLogEntries.filter(e => e.status === 'Success').length;
                    const iFailCount = aLogEntries.length - iSuccessCount;

                    return {
                        message: `Validated ${aLogEntries.length} rows: ${iSuccessCount} passed, ${iFailCount} failed. Review and confirm to post.`,
                        totalRows: aLogEntries.length,
                        successCount: iSuccessCount,
                        failCount: iFailCount
                    };
                });
            })
            .catch((oError) => {
                const aHandledErrors = ["FILE_READ_FAILED", "NO_WORKSHEET", "NO_DATA_ROWS"];
                if (!aHandledErrors.includes(oError.message)) {
                    req.error(500, `Upload failed: ${oError.message}`);
                }
            });
    });

    // ============================
    // Step 2: User confirms selected rows -> NOW insert into VanStockProfile
    // ============================
    this.on('postProfiles', (req) => {
        const { logIds } = req.data;

        if (!logIds || logIds.length === 0) {
            req.error(400, "No rows selected to post");
            return Promise.resolve();
        }

        return SELECT.from(UploadLog).where({ ID: { in: logIds } })
            .then((aSelectedLogs) => {
                const aAlreadyPosted = aSelectedLogs.filter(e => e.posted);
                const aFailedRows = aSelectedLogs.filter(e => e.status !== 'Success');
                const aToPost = aSelectedLogs.filter(e => e.status === 'Success' && !e.posted);

                if (aAlreadyPosted.length > 0) {
                    return Promise.reject(new Error(`${aAlreadyPosted.length} selected row(s) were already posted`));
                }

                if (aFailedRows.length > 0) {
                    return Promise.reject(new Error(`${aFailedRows.length} selected row(s) failed validation and cannot be posted`));
                }

                if (aToPost.length === 0) {
                    return Promise.reject(new Error("No valid rows to post"));
                }

                const aProfilesToInsert = aToPost.map((oLog) => ({
                    ID: cds.utils.uuid(),
                    createdOn: new Date(),
                    engineerId: oLog.engineerId,
                    profitCenter: oLog.profitCenter,
                    partNumber: oLog.partNumber,
                    quantity: oLog.quantity,
                    value: oLog.value
                }));

                return INSERT.into(VanStockProfile).entries(aProfilesToInsert)
                    .then(() => {
                        // mark these log rows as posted so they can't be posted again
                        return UPDATE(UploadLog)
                            .set({ posted: true })
                            .where({ ID: { in: aToPost.map(e => e.ID) } });
                    })
                    .then(() => ({
                        message: `${aToPost.length} record(s) posted to Van Stock Profile`,
                        postedCount: aToPost.length
                    }));
            })
            .catch((oError) => {
                req.error(400, oError.message);
            });
    });

});