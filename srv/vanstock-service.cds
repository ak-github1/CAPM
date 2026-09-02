using { vanstock } from '../db/schema';
using from '../db/uploadlog';

service VanStockProfile {
    entity VanStockProfile as projection on vanstock.VanStockProfiles;
    entity UploadLog       as projection on vanstock.UploadLogs;

    action uploadProfile(file: LargeBinary, mimetype: String) returns {
        message      : String;
        totalRows    : Integer;
        successCount : Integer;
        failCount    : Integer;
    };

    action postProfiles(logIds: array of UUID) returns {
        message    : String;
        postedCount: Integer;
    };
};