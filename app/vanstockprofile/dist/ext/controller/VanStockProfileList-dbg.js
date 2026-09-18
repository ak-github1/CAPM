sap.ui.define([
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment"
], function (MessageToast, MessageBox, Fragment) {
    'use strict';

    var CHUNK_SIZE = 2000; // bumped up from 500 — test and adjust further if needed

    function parseExcelFile(oFile) {
        return oFile.arrayBuffer().then(function (arrayBuffer) {
            var workbook = new ExcelJS.Workbook();
            return workbook.xlsx.load(arrayBuffer);
        }).then(function (workbook) {
            var worksheet = workbook.worksheets[0];
            var aAllRows = [];

            worksheet.eachRow(function (row, rowNumber) {
                if (rowNumber === 1) return;

                var engineerId = row.getCell(1).value;
                var profitCenter = row.getCell(2).value;
                var partNumber = row.getCell(3).value;
                var quantity = row.getCell(4).value;
                var value = row.getCell(5).value;

                if (!engineerId && !profitCenter && !partNumber && !quantity && !value) {
                    return;
                }

                aAllRows.push({
                    rowNumber: rowNumber,
                    engineerId: engineerId ? String(engineerId) : null,
                    profitCenter: profitCenter ? String(profitCenter) : null,
                    partNumber: partNumber ? String(partNumber) : null,
                    quantity: isNaN(Number(quantity)) ? null : Number(quantity),
                    value: isNaN(Number(value)) ? null : Number(value)
                });
            });

            if (aAllRows.length === 0) {
                return Promise.reject(new Error("NO_ROWS"));
            }

            return aAllRows;
        });
    }

    function sendRows(oModel, sActionName, aAllRows, sLabelPrefix, bNoChunk, fnProgress) {
        var aChunks;

        if (bNoChunk) {
            aChunks = [aAllRows];
        } else {
            aChunks = [];
            for (var i = 0; i < aAllRows.length; i += CHUNK_SIZE) {
                aChunks.push(aAllRows.slice(i, i + CHUNK_SIZE));
            }
        }

        var iTotalSuccess = 0;
        var iTotalFail = 0;
        var iChunkIndex = 0;

        function sendNextChunk() {
            if (iChunkIndex >= aChunks.length) {
                return Promise.resolve({ successCount: iTotalSuccess, failCount: iTotalFail });
            }

            var aChunkRows = aChunks[iChunkIndex];
            iChunkIndex++;

            var sProgressMsg = bNoChunk
                ? sLabelPrefix + "Uploading all " + aChunkRows.length + " rows in one request..."
                : sLabelPrefix + "Uploading chunk " + iChunkIndex + " of " + aChunks.length + "...";

            MessageToast.show(sProgressMsg);
            if (fnProgress) { fnProgress(sProgressMsg); }
            debugger
            var oOperation = oModel.bindContext("/" + sActionName + "(...)", null, { $$groupId: '$direct' });
            oOperation.setParameter("rows", aChunkRows);

            return oOperation.execute().then(function () {
                var oResult = oOperation.getBoundContext().getObject();
                iTotalSuccess += oResult.successCount;
                iTotalFail += oResult.failCount;
                return sendNextChunk();
            });
        }

        return sendNextChunk();
    }

    function findModelAndComponent() {
        var oModel = null;
        var oComponent = null;
        sap.ui.core.Component.registry.forEach(function (oComp) {
            if (!oModel && oComp.getModel && oComp.getModel()) {
                oModel = oComp.getModel();
                oComponent = oComp;
            }
        });
        return { oModel: oModel, oComponent: oComponent };
    }

    function createUploadFlow(sFragmentId, sActionName, sLabelPrefix) {
        var oDialog = null;
        var oSelectedFile = null;

        var oHandlers = {
            onFileChange: function (oEvent) {
                var aFiles = oEvent.getParameter("files");
                if (!aFiles || aFiles.length === 0) {
                    MessageToast.show("No file selected");
                    return;
                }
                oSelectedFile = aFiles[0];
                MessageToast.show("File selected: " + oSelectedFile.name);
            },

            onUpload: function () {
                if (!oSelectedFile) {
                    MessageToast.show("Please select an Excel file first");
                    return;
                }

                var oFile = oSelectedFile;
                var oFound = findModelAndComponent();

                if (!oFound.oModel) {
                    MessageToast.show("Could not find OData model on control");
                    return;
                }

                var oNoChunkRadio = Fragment.byId(sFragmentId, "noChunkModeRadio");
                var oFullStreamRadio = Fragment.byId(sFragmentId, "fullStreamModeRadio");

                var bNoChunk = !!(oNoChunkRadio && oNoChunkRadio.getSelected());
                var bFullStream = !!(oFullStreamRadio && oFullStreamRadio.getSelected());

                var dStart = Date.now();
                oDialog.setBusy(true);
                oDialog.setBusyIndicatorDelay(0);

                if (bFullStream) {
                    // ===== FULL STREAM: send raw file, backend streams + processes it =====
                    var oReader = new FileReader();

                    oReader.onload = function (event) {
                        var sBase64 = event.target.result.split(",")[1];

                        var oOperation = oFound.oModel.bindContext("/uploadProfileFull(...)", null, { $$groupId: '$direct' });
                        oOperation.setParameter("file", sBase64);
                        oOperation.setParameter("mimetype", oFile.type);

                        oOperation.execute().then(function () {
                            var oResult = oOperation.getBoundContext().getObject();
                            var iDurationMs = Date.now() - dStart;

                            oDialog.setBusy(false);
                            oSelectedFile = null;
                            oDialog.close();

                            MessageBox.success(
                                oResult.message + "\nCompleted in " + iDurationMs + "ms.",
                                {
                                    title: "Upload Complete",
                                    onClose: function () {
                                        if (oFound.oComponent && oFound.oComponent.getRouter) {
                                            oFound.oComponent.getRouter().navTo("UploadLogList");
                                        }
                                    }
                                }
                            );
                        }).catch(function (oError) {
                            oDialog.setBusy(false);
                            MessageBox.error((oError.message || "Unknown error"), { title: "Upload Failed" });
                        });
                    };

                    oReader.onerror = function () {
                        oDialog.setBusy(false);
                        MessageBox.error("Could not read the file");
                    };

                    oReader.readAsDataURL(oFile);

                } else {
                    // ===== CHUNK or NO-CHUNK (JSON, browser-parsed) — existing logic =====
                    if (typeof ExcelJS === 'undefined') {
                        oDialog.setBusy(false);
                        MessageToast.show("ExcelJS library not loaded — check index.html");
                        return;
                    }

                    parseExcelFile(oFile).then(function (aAllRows) {
                        return sendRows(oFound.oModel, sActionName, aAllRows, sLabelPrefix, bNoChunk);
                    }).then(function (oSummary) {
                        var iDurationMs = Date.now() - dStart;
                        oDialog.setBusy(false);
                        oSelectedFile = null;
                        oDialog.close();

                        MessageBox.success(
                            oSummary.successCount + " row(s) passed, " + oSummary.failCount + " row(s) failed.\n" +
                            "Completed in " + iDurationMs + "ms.",
                            {
                                title: sLabelPrefix + "Upload Complete",
                                onClose: function () {
                                    if (oFound.oComponent && oFound.oComponent.getRouter) {
                                        oFound.oComponent.getRouter().navTo("UploadLogList");
                                    }
                                }
                            }
                        );
                    }).catch(function (oError) {
                        oDialog.setBusy(false);
                        if (oError && oError.message === "NO_ROWS") {
                            MessageBox.warning("No data rows found in the file");
                        } else {
                            MessageBox.error((oError && oError.message) || "Unknown error", { title: "Upload Failed" });
                        }
                    });
                }
            },
            onCancel: function () {
                oSelectedFile = null;
                var oFileUploader = Fragment.byId(sFragmentId, "excelFileUploader");
                if (oFileUploader) { oFileUploader.clear(); }
                oDialog.close();
            }
        };

        return function openDialog() {
            if (oDialog) {
                oDialog.open();
                return;
            }

            Fragment.load({
                id: sFragmentId,
                name: "com.vanstockprofile.ext.fragment.ExcelUpload",
                controller: oHandlers
            }).then(function (oLoadedDialog) {
                oDialog = oLoadedDialog;
                 // Procedure flow doesn't support full-stream mode — hide that option
        if (sFragmentId === "excelUploadFragmentProc") {
            var oFullStreamRadio = Fragment.byId(sFragmentId, "fullStreamModeRadio");
            if (oFullStreamRadio) { oFullStreamRadio.setVisible(false); }
        }
                oDialog.open();
            });
        };
    }

    // Both flows now get the same radio choice (chunk vs. no-chunk)
    var openNodeJsUploadDialog = createUploadFlow("excelUploadFragment", "uploadProfileChunk", "");
    var openProcedureUploadDialog = createUploadFlow("excelUploadFragmentProc", "uploadProfileChunkViaProcedure", "[Procedure] ");
    return {
        uploadProfile: function (oContext, aSelectedContexts) {
            openNodeJsUploadDialog();
        },
        uploadProfileViaProcedure: function (oContext, aSelectedContexts) {
            openProcedureUploadDialog();
        }
    };
});