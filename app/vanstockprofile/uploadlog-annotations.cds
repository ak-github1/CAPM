using VanStockProfile as service from '../../srv/vanstock-service';

annotate service.UploadLog with @(
    UI.HeaderInfo: {
        TypeName: 'Upload Log',
        TypeNamePlural: 'Upload Logs',
        Title: { Value: partNumber }
    },

    UI.LineItem: [
        { Value: rowNumber,    Label: 'Row' },
        { Value: engineerId,   Label: 'Engineer ID' },
        { Value: profitCenter, Label: 'Profit Center' },
        { Value: partNumber,   Label: 'Part Number' },
        { Value: quantity,     Label: 'Quantity' },
        { Value: value,        Label: 'Value' },
        { Value: status,       Label: 'Status' },
        { Value: remark,       Label: 'Remark' },
        { Value: uploadedOn,   Label: 'Uploaded On' },
        { Value: uploadedBy,   Label: 'Uploaded By' }
    ],

    // UI.SelectionFields: [
    //     status,
    //     engineerId,
    //     profitCenter
    // ]
);