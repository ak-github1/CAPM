using VanStockProfile as service from '../../srv/vanstock-service';
annotate service.VanStockProfile with @(
    UI.FieldGroup #GeneratedGroup : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Label : 'createdOn',
                Value : createdOn,
            },
            {
                $Type : 'UI.DataField',
                Label : 'engineerId',
                Value : engineerId,
            },
            {
                $Type : 'UI.DataField',
                Label : 'profitCenter',
                Value : profitCenter,
            },
            {
                $Type : 'UI.DataField',
                Label : 'partNumber',
                Value : partNumber,
            },
            {
                $Type : 'UI.DataField',
                Label : 'quantity',
                Value : quantity,
            },
            {
                $Type : 'UI.DataField',
                Label : 'value',
                Value : value,
            },
        ],
    },
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'GeneratedFacet1',
            Label : 'General Information',
            Target : '@UI.FieldGroup#GeneratedGroup',
        },
    ],
    UI.LineItem : [
        {
            $Type : 'UI.DataField',
            Label : 'createdOn',
            Value : createdOn,
        },
        {
            $Type : 'UI.DataField',
            Label : 'engineerId',
            Value : engineerId,
        },
        {
            $Type : 'UI.DataField',
            Label : 'profitCenter',
            Value : profitCenter,
        },
        {
            $Type : 'UI.DataField',
            Label : 'partNumber',
            Value : partNumber,
        },
        {
            $Type : 'UI.DataField',
            Label : 'quantity',
            Value : quantity,
        },
    ],
);

