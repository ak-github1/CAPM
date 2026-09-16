const cds = require("@sap/cds");
const ExcelJS = require('exceljs');
const { Readable } = require('stream');
const { loadLookups, validateRow } = require('./lib/validation');

const RESULT_SET_SIZE = 10000; // collect exactly this many rows before processing

/**
 * Streams the Excel file and processes it in fixed-size result sets:
 *   1. Collect up to RESULT_SET_SIZE rows into a result set (array)
 *   2. Validate + insert that result set into UploadLog
 *   3. CLEAR the result set completely
 *   4. Continue collecting the NEXT RESULT_SET_SIZE rows from the stream
 * At no point does the full file sit in memory — only one result set
 * (max 10,000 rows) exists at any given moment.
 */
//uploading data first to upload log table and then on button click upload to main table
async function processExcelStream(buffer, oLookups, UploadLog, sUploadedBy) {
    const oStream = Readable.from(buffer);

    const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(oStream, {
        entries: 'emit',
        sharedStrings: 'cache',
        hyperlinks: 'ignore',
        styles: 'ignore'
    });

    let iTotalRows = 0;
    let iSuccessCount = 0;
    let iFailCount = 0;
    const dUploadedOn = new Date();

    let aResultSet = [];

    async function processAndClearResultSet() {
        if (aResultSet.length === 0) {
            return;
        }
        await INSERT.into(UploadLog).entries(aResultSet);
        aResultSet = [];
    }

    for await (const worksheetReader of workbookReader) {
        let iRowNumber = 0;

        for await (const row of worksheetReader) {
            iRowNumber++;

            if (iRowNumber === 1) {
                continue;
            }

            const engineerId = row.getCell(1).value;
            const profitCenter = row.getCell(2).value;
            const partNumber = row.getCell(3).value;
            const quantity = row.getCell(4).value;
            const value = row.getCell(5).value;

            if (!engineerId && !profitCenter && !partNumber && !quantity && !value) {
                continue;
            }

            const oRawRow = { rowNumber: iRowNumber, engineerId, profitCenter, partNumber, quantity, value };
            const oResult = validateRow(oRawRow, oLookups);

            if (oResult.isValid) {
                iSuccessCount++;
            } else {
                iFailCount++;
            }

            aResultSet.push({
                ID: cds.utils.uuid(),
                uploadedOn: dUploadedOn,
                uploadedBy: sUploadedBy,
                rowNumber: iRowNumber,
                engineerId: engineerId ? String(engineerId) : null,
                profitCenter: profitCenter ? String(profitCenter) : null,
                partNumber: partNumber ? String(partNumber) : null,
                quantity: isNaN(Number(quantity)) ? null : Number(quantity),
                value: isNaN(Number(value)) ? null : Number(value),
                status: oResult.isValid ? 'Success' : 'Failed',
                remark: oResult.isValid ? '' : oResult.errors.join('; '),
                posted: false
            });

            iTotalRows++;

            if (aResultSet.length >= RESULT_SET_SIZE) {
                await processAndClearResultSet();
            }
        }
    }

    await processAndClearResultSet();

    return { iTotalRows, iSuccessCount, iFailCount };
}

//uploading data directly to main vanstock table and upload log table using batch

async function processExcelFullStream(buffer, oLookups, UploadLog, VanStockProfile, sUploadedBy) {
    const oStream = Readable.from(buffer);

    const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(oStream, {
        entries: 'emit',
        sharedStrings: 'cache',
        hyperlinks: 'ignore',
        styles: 'ignore'
    });

    let iTotalRows = 0;
    let iSuccessCount = 0;
    let iFailCount = 0;
    const dUploadedOn = new Date();

    let aLogResultSet = [];
    let aProfileResultSet = [];

    async function flushResultSets() {
        if (aLogResultSet.length > 0) {
            await INSERT.into(UploadLog).entries(aLogResultSet);
            aLogResultSet = [];
        }
        if (aProfileResultSet.length > 0) {
            await INSERT.into(VanStockProfile).entries(aProfileResultSet);
            aProfileResultSet = [];
        }
    }

    for await (const worksheetReader of workbookReader) {
        let iRowNumber = 0;

        for await (const row of worksheetReader) {
            iRowNumber++;

            if (iRowNumber === 1) {
                continue;
            }

            const engineerId = row.getCell(1).value;
            const profitCenter = row.getCell(2).value;
            const partNumber = row.getCell(3).value;
            const quantity = row.getCell(4).value;
            const value = row.getCell(5).value;

            if (!engineerId && !profitCenter && !partNumber && !quantity && !value) {
                continue;
            }

            const oRawRow = { rowNumber: iRowNumber, engineerId, profitCenter, partNumber, quantity, value };
            const oResult = validateRow(oRawRow, oLookups);

            if (oResult.isValid) {
                iSuccessCount++;
            } else {
                iFailCount++;
            }

            aLogResultSet.push({
                ID: cds.utils.uuid(),
                uploadedOn: dUploadedOn,
                uploadedBy: sUploadedBy,
                rowNumber: iRowNumber,
                engineerId: engineerId ? String(engineerId) : null,
                profitCenter: profitCenter ? String(profitCenter) : null,
                partNumber: partNumber ? String(partNumber) : null,
                quantity: isNaN(Number(quantity)) ? null : Number(quantity),
                value: isNaN(Number(value)) ? null : Number(value),
                status: oResult.isValid ? 'Success' : 'Failed',
                remark: oResult.isValid ? '' : oResult.errors.join('; '),
                posted: oResult.isValid
            });

            if (oResult.isValid) {
                aProfileResultSet.push({
                    ID: cds.utils.uuid(),
                    createdOn: new Date(),
                    engineerId: String(engineerId),
                    profitCenter: String(profitCenter),
                    partNumber: String(partNumber),
                    quantity: Number(quantity),
                    value: Number(value)
                });
            }

            iTotalRows++;

            if (aLogResultSet.length >= RESULT_SET_SIZE) {
                await flushResultSets();
            }
        }
    }

    await flushResultSets();

    return { iTotalRows, iSuccessCount, iFailCount };
}


module.exports = cds.service.impl(function () {
    const { VanStockProfile, UploadLog } = this.entities;
    //commented code without batchId
    this.on('uploadProfile', (req) => {
        const { file } = req.data;

        if (!file) {
            req.error(400, "No file provided");
            return Promise.resolve();
        }

        let buffer;
        try {
            buffer = Buffer.from(file, 'base64');
        } catch (oError) {
            req.error(400, "Could not read the uploaded file");
            return Promise.resolve();
        }

        const sUploadedBy = req.user ? req.user.id : 'unknown';

        return loadLookups()
            .then((oLookups) => {
                return processExcelStream(buffer, oLookups, UploadLog, sUploadedBy);
            })
            .then((oSummary) => {
                if (oSummary.iTotalRows === 0) {
                    req.error(400, 'Excel file does not contain any data rows');
                    return;
                }

                return {
                    message: `Processed ${oSummary.iTotalRows} rows: ${oSummary.iSuccessCount} passed, ${oSummary.iFailCount} failed. Review and confirm to post.`,
                    totalRows: oSummary.iTotalRows,
                    successCount: oSummary.iSuccessCount,
                    failCount: oSummary.iFailCount
                };
            })
            .catch((oError) => {
                req.error(500, `Upload failed: ${oError.message}`);
            });
    });
    this.on('uploadProfileFull', (req) => {
        const { file } = req.data;

        if (!file) {
            req.error(400, "No file provided");
            return Promise.resolve();
        }

        let buffer;
        try {
            buffer = Buffer.from(file, 'base64');
        } catch (oError) {
            req.error(400, "Could not read the uploaded file");
            return Promise.resolve();
        }

        const sUploadedBy = req.user ? req.user.id : 'unknown';

        return loadLookups()
            .then((oLookups) => processExcelFullStream(buffer, oLookups, UploadLog, VanStockProfile, sUploadedBy))
            .then((oSummary) => {
                if (oSummary.iTotalRows === 0) {
                    req.error(400, 'Excel file does not contain any data rows');
                    return;
                }
                return {
                    message: `Processed ${oSummary.iTotalRows} rows: ${oSummary.iSuccessCount} passed, ${oSummary.iFailCount} failed.`,
                    totalRows: oSummary.iTotalRows,
                    successCount: oSummary.iSuccessCount,
                    failCount: oSummary.iFailCount
                };
            })
            .catch((oError) => {
                req.error(500, `Upload failed: ${oError.message}`);
            });
    });
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

                const BATCH_SIZE = 10000;
                let pChain = Promise.resolve();
                for (let i = 0; i < aProfilesToInsert.length; i += BATCH_SIZE) {
                    const batch = aProfilesToInsert.slice(i, i + BATCH_SIZE);
                    pChain = pChain.then(() => INSERT.into(VanStockProfile).entries(batch));
                }

                return pChain
                    .then(() => UPDATE(UploadLog).set({ posted: true }).where({ ID: { in: aToPost.map(e => e.ID) } }))
                    .then(() => ({
                        message: `${aToPost.length} record(s) posted to Van Stock Profile`,
                        postedCount: aToPost.length
                    }));
            })
            .catch((oError) => {
                req.error(400, oError.message);
            });
    });

    this.on('uploadProfileChunk', (req) => {
        const { rows } = req.data;

        if (!rows || rows.length === 0) {
            req.error(400, "No rows provided");
            return Promise.resolve();
        }

        const sUploadedBy = req.user ? req.user.id : 'unknown';
        const dUploadedOn = new Date();

        return loadLookups().then((oLookups) => {
            const aLogEntries = rows.map((oRawRow) => {
                const oResult = validateRow(oRawRow, oLookups);

                return {
                    ID: cds.utils.uuid(),
                    uploadedOn: dUploadedOn,
                    uploadedBy: sUploadedBy,
                    rowNumber: oRawRow.rowNumber,
                    engineerId: oRawRow.engineerId || null,
                    profitCenter: oRawRow.profitCenter || null,
                    partNumber: oRawRow.partNumber || null,
                    quantity: oRawRow.quantity,
                    value: oRawRow.value,
                    status: oResult.isValid ? 'Success' : 'Failed',
                    remark: oResult.isValid ? '' : oResult.errors.join('; '),
                    posted: false
                };
            });

            return INSERT.into(UploadLog).entries(aLogEntries).then(() => {
                const iSuccessCount = aLogEntries.filter(e => e.status === 'Success').length;
                return {
                    successCount: iSuccessCount,
                    failCount: aLogEntries.length - iSuccessCount
                };
            });
        }).catch((oError) => {
            req.error(500, `Chunk upload failed: ${oError.message}`);
        });
    });

    // ============================
    // NEW — Post ALL unposted successful rows at once, no manual selection
    // (avoids the 200-item UI selection limit at large scale)
    // ============================
    this.on('postAllProfiles', (req) => {
        return SELECT.from(UploadLog).where({ status: 'Success', posted: false })
            .then((aToPost) => {
                if (aToPost.length === 0) {
                    return { message: "No unposted successful rows found", postedCount: 0 };
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

                const BATCH_SIZE = 5000;
                let pChain = Promise.resolve();
                for (let i = 0; i < aProfilesToInsert.length; i += BATCH_SIZE) {
                    const batch = aProfilesToInsert.slice(i, i + BATCH_SIZE);
                    pChain = pChain.then(() => INSERT.into(VanStockProfile).entries(batch));
                }

                return pChain
                    .then(() => UPDATE(UploadLog).set({ posted: true }).where({ status: 'Success', posted: false }))
                    .then(() => ({
                        message: `${aToPost.length} record(s) posted to Van Stock Profile`,
                        postedCount: aToPost.length
                    }));
            })
            .catch((oError) => {
                req.error(500, `Post all failed: ${oError.message}`);
            });
    });
    //Procedure
    this.on('uploadProfileChunkViaProcedure', (req) => {
        const { rows } = req.data;

        if (!rows || rows.length === 0) {
            req.error(400, "No rows provided");
            return Promise.resolve();
        }

        const sUploadedBy = req.user ? req.user.id : 'unknown';
        const ltt = `#TEMP_VANSTOCK_${cds.utils.uuid().replace(/-/g, '')}`;

        return cds.run(`
        CREATE LOCAL TEMPORARY TABLE ${ltt} (
            ROWNUMBER INTEGER, ENGINEERID NVARCHAR(20), PROFITCENTER NVARCHAR(10),
            PARTNUMBER NVARCHAR(40), QUANTITY DECIMAL(13,3), VALUE DECIMAL(15,2)
        )
    `).then(() => {
            // Batch insert: array of parameter-arrays, one per row —
            // this is cds.run's documented way to do multi-row inserts.
            const aParamRows = rows.map((r) => [
                r.rowNumber, r.engineerId, r.profitCenter, r.partNumber, r.quantity, r.value
            ]);

            return cds.run(
                `INSERT INTO ${ltt} (ROWNUMBER, ENGINEERID, PROFITCENTER, PARTNUMBER, QUANTITY, VALUE) VALUES (?, ?, ?, ?, ?, ?)`,
                aParamRows
            );
        }).then(() => {
            // No JS Date passed as a parameter — HANA generates the
            // timestamp itself via CURRENT_TIMESTAMP, avoiding any
            // JS-to-TIMESTAMP type mismatch entirely.
            return cds.run(
                `CALL VALIDATE_AND_LOG_VANSTOCK(IT_ROWS => ${ltt}, UPLOADED_BY => ?, UPLOADED_ON => CURRENT_TIMESTAMP, ET_SUMMARY => ?)`,
                [sUploadedBy]
            );
        }).then((oResult) => {
            return cds.run(`DROP TABLE ${ltt}`).then(() => oResult);
        }).then((oResult) => {
            const oSummary = oResult.ET_SUMMARY[0];
            return {
                successCount: Number(oSummary.SUCCESS_COUNT || 0),
                failCount: Number(oSummary.FAIL_COUNT || 0)
            };
        }).catch((oError) => {
            req.error(500, `Procedure chunk upload failed: ${oError.message}`);
        });
    });
});