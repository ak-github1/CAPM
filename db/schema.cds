namespace vanstock;

entity VanStockProfiles {
    key ID        : UUID;
    createdOn   : Date;
    engineerId   : String(20);
    profitCenter : String(10);
    partNumber   : String(40);
    quantity     : Decimal(13, 3);
    value        : Decimal(15, 2);
}
