const cds = require("@sap/cds");

/**
 * Preloads master data lookups once, so we don't hit the database
 * once per row. Call this ONCE before validating a batch of rows.
 */
async function loadLookups() {
    const { ProfitCenters, Materials } = cds.entities('vanstock');

    const aProfitCenters = await SELECT.from(ProfitCenters)
        .columns('ProfitCenter', 'Status');

    const aMaterials = await SELECT.from(Materials)
        .columns('MaterialNumber', 'Status');

    // Build fast lookup maps: code -> status
    const oProfitCenterMap = {};
    aProfitCenters.forEach((oPC) => {
        oProfitCenterMap[oPC.ProfitCenter] = oPC.Status;
    });

    const oMaterialMap = {};
    aMaterials.forEach((oMat) => {
        oMaterialMap[oMat.MaterialNumber] = oMat.Status;
    });

    return { oProfitCenterMap, oMaterialMap };
}

/**
 * Validates a single row of uploaded data.
 *
 * @param {Object} oRow - { engineerId, profitCenter, partNumber, quantity, value }
 * @param {Object} oLookups - result of loadLookups()
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
function validateRow(oRow, oLookups) {
    const aErrors = [];
    const { oProfitCenterMap, oMaterialMap } = oLookups;

    // ---- Required field checks ----
    if (!oRow.engineerId || String(oRow.engineerId).trim() === '') {
        aErrors.push('Engineer ID is required');
    }

    if (!oRow.profitCenter || String(oRow.profitCenter).trim() === '') {
        aErrors.push('Profit Center is required');
    }

    if (!oRow.partNumber || String(oRow.partNumber).trim() === '') {
        aErrors.push('Part Number is required');
    }

    // ---- Length checks (matches CDS field lengths) ----
    if (oRow.engineerId && String(oRow.engineerId).length > 20) {
        aErrors.push('Engineer ID exceeds 20 characters');
    }

    if (oRow.profitCenter && String(oRow.profitCenter).length > 10) {
        aErrors.push('Profit Center exceeds 10 characters');
    }

    if (oRow.partNumber && String(oRow.partNumber).length > 40) {
        aErrors.push('Part Number exceeds 40 characters');
    }

    // ---- Profit Center master data check ----
    if (oRow.profitCenter) {
        const sPCStatus = oProfitCenterMap[oRow.profitCenter];

        if (sPCStatus === undefined) {
            aErrors.push(`Profit Center ${oRow.profitCenter} does not exist`);
        } else if (sPCStatus !== 'A') {
            aErrors.push(`Profit Center ${oRow.profitCenter} is inactive`);
        }
    }

    // ---- Part Number master data check ----
    if (oRow.partNumber) {
        const sMatStatus = oMaterialMap[oRow.partNumber];

        if (sMatStatus === undefined) {
            aErrors.push(`Part Number ${oRow.partNumber} does not exist`);
        } else if (sMatStatus !== 'A') {
            aErrors.push(`Part Number ${oRow.partNumber} is inactive`);
        }
    }

    // ---- Quantity checks ----
    if (oRow.quantity === null || oRow.quantity === undefined || oRow.quantity === '') {
        aErrors.push('Quantity is required');
    } else if (isNaN(Number(oRow.quantity))) {
        aErrors.push('Quantity must be a valid number');
    } else if (Number(oRow.quantity) <= 0) {
        aErrors.push('Quantity must be greater than 0');
    }

    // ---- Value checks ----
    if (oRow.value === null || oRow.value === undefined || oRow.value === '') {
        aErrors.push('Value is required');
    } else if (isNaN(Number(oRow.value))) {
        aErrors.push('Value must be a valid number');
    } else if (Number(oRow.value) < 0) {
        aErrors.push('Value cannot be negative');
    }

    return {
        isValid: aErrors.length === 0,
        errors: aErrors
    };
}

module.exports = {
    loadLookups,
    validateRow
};