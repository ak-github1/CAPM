using {vanstock} from '../db/schema';
using from '../db/uploadlog';

service VanStockProfile {
    entity VanStockProfile    as projection on vanstock.VanStockProfiles;
    entity UploadLog          as projection on vanstock.UploadLogs;
   

    action uploadProfile(file: LargeBinary, mimetype: String) returns {
        message      : String;
        totalRows    : Integer;
        successCount : Integer;
        failCount    : Integer;
    };
    
action uploadProfileFull(file: LargeBinary, mimetype: String) returns {
    message      : String;
    totalRows    : Integer;
    successCount : Integer;
    failCount    : Integer;
};
    action postProfiles(logIds: array of UUID)                        returns {
        message     : String;
        postedCount : Integer;
    };

    action postAllProfiles()                                          returns {
        message     : String;
        postedCount : Integer;
    };

    type VanStockRow {
        rowNumber    : Integer;
        engineerId   : String(20);
        profitCenter : String(10);
        partNumber   : String(40);
        quantity     : Decimal(13, 3);
        value        : Decimal(15, 2);
    };

    action uploadProfileChunk(rows: array of VanStockRow)             returns {
        successCount : Integer;
        failCount    : Integer;
    };

    //Procedural
    action uploadProfileChunkViaProcedure(rows: array of VanStockRow) returns {
        successCount : Integer;
        failCount    : Integer;
    };

};
