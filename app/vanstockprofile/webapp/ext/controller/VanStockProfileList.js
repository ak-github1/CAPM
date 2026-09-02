sap.ui.define([
    "sap/m/MessageToast",
    "sap/ui/core/Fragment"
], function (MessageToast, Fragment) {
    'use strict';

    return {
        uploadProfile: function (oContext, aSelectedContexts) {

            if (this._oUploadDialog) {
                this._oUploadDialog.open();
                return;
            }

            Fragment.load({
                id: "excelUploadFragment",
                name: "com.vanstockprofile.ext.fragment.ExcelUpload"
            }).then((oDialog) => {

                this._oUploadDialog = oDialog;
                this._oSelectedFile = null;

                var oFileUploader = Fragment.byId("excelUploadFragment", "excelFileUploader");
                var oUploadButton = oDialog.getBeginButton();
                var oCancelButton = oDialog.getEndButton();

                oFileUploader.attachChange((oEvent) => {
                    var aFiles = oEvent.getParameter("files");
                    if (!aFiles || aFiles.length === 0) {
                        MessageToast.show("No file selected");
                        return;
                    }
                    this._oSelectedFile = aFiles[0];
                    MessageToast.show("File selected: " + this._oSelectedFile.name);
                });

                oUploadButton.attachPress(() => {

                    if (!this._oSelectedFile) {
                        MessageToast.show("Please select an Excel file first");
                        return;
                    }

                    var oFile = this._oSelectedFile;
                    var oReader = new FileReader();

                    oReader.onload = (event) => {
                        try {
                            var sBase64 = event.target.result.split(",")[1];

                            var oModel = null;
                            var oComponent = null;
                            sap.ui.core.Component.registry.forEach(function (oComp) {
                                if (!oModel && oComp.getModel && oComp.getModel()) {
                                    oModel = oComp.getModel();
                                    oComponent = oComp;
                                }
                            });

                            if (!oModel) {
                                MessageToast.show("Could not find OData model on control");
                                return;
                            }

                            var oOperation = oModel.bindContext("/uploadProfile(...)");
                            oOperation.setParameter("file", sBase64);
                            oOperation.setParameter("mimeType", oFile.type);

                            oOperation.execute().then(() => {
                                var aResults = oOperation.getBoundContext().getObject();
                                var iCount = aResults && aResults.value ? aResults.value.length : 0;

                                MessageToast.show("Upload successful. Records created: " + iCount);

                                this._oSelectedFile = null;
                                this._oUploadDialog.close();
                                 // Navigate to the UploadLog results page
                                if (oComponent && oComponent.getRouter) {
                                    oComponent.getRouter().navTo("UploadLogList");
                                }

                            }).catch(function (oError) {
                                MessageToast.show("Upload failed: " + (oError.message || "Unknown error"));
                            });

                        } catch (oInnerError) {
                            MessageToast.show("File processing failed: " + oInnerError.message);
                        }
                    };

                    oReader.onerror = function () {
                        MessageToast.show("Could not read the file");
                    };

                    oReader.readAsDataURL(oFile);
                });

                oCancelButton.attachPress(() => {
                    this._oSelectedFile = null;
                    if (oFileUploader) { oFileUploader.clear(); }
                    this._oUploadDialog.close();
                });

                oDialog.open();
            });

        }
    };
});