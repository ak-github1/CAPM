namespace vanstock;

entity UploadLogs {
    key ID           : UUID;
        uploadedOn   : Timestamp;
        uploadedBy   : String(40);
        rowNumber    : Integer;
        engineerId   : String(20);
        profitCenter : String(10);
        partNumber   : String(40);
        quantity     : Decimal(13, 3);
        value        : Decimal(15, 2);
        status       : String(10); // 'Success' or 'Failed'
        remark       : String(200); // reason for failure, or blank on success
        posted       : Boolean default false; // <-- confirm this line exists
}
