namespace vanstock;

entity ProfitCenters {
    key ProfitCenter   : String(10);
        ControllingArea : String(4);
        Name            : String(40);
        Description     : String(60);
        CompanyCode     : String(4);
        ValidFrom       : Date;
        ValidTo         : Date;
        Status          : String(1);  // 'A' = Active, 'I' = Inactive
}

entity Materials {
    key MaterialNumber     : String(40);
        MaterialDescription : String(60);
        MaterialType        : String(4);   // e.g. 'ROH', 'FERT', 'HALB'
        BaseUnit            : String(3);   // e.g. 'EA', 'KG', 'PC'
        Plant               : String(4);
        Status              : String(1);   // 'A' = Active, 'I' = Inactive
}