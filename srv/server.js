const cds = require('@sap/cds');
const express = require('express');

cds.on('bootstrap', (app) => {
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));
});

module.exports = cds.server;