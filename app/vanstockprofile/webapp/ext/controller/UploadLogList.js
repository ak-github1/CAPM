sap.ui.define([
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (MessageToast, MessageBox) {
    'use strict';

    return {
        postProfiles: function (oContext, aSelectedContexts) {

            var oModel = null;
            sap.ui.core.Component.registry.forEach(function (oComp) {
                if (!oModel && oComp.getModel && oComp.getModel()) {
                    oModel = oComp.getModel();
                }
            });

            if (!oModel) {
                MessageToast.show("Could not find OData model on control");
                return;
            }

            var oOperation = oModel.bindContext("/postAllProfiles(...)");

            MessageToast.show("Posting all unposted successful rows, please wait...");

            oOperation.execute().then(function () {
                var oResult = oOperation.getBoundContext().getObject();

                MessageToast.show(oResult.message || "Posted successfully");

                oModel.refresh();

            }).catch(function (oError) {
                MessageBox.error("Post failed: " + (oError.message || "Unknown error"));
            });
        }
    };
});