sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"com/vanstockprofile/test/integration/pages/VanStockProfileList.gen",
	"com/vanstockprofile/test/integration/pages/VanStockProfileObjectPage.gen"
], function (JourneyRunner, VanStockProfileListGenerated, VanStockProfileObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('com/vanstockprofile') + '/test/flp.html#app-preview',
        pages: {
			onTheVanStockProfileListGenerated: VanStockProfileListGenerated,
			onTheVanStockProfileObjectPageGenerated: VanStockProfileObjectPageGenerated
        },
        async: true
    });

    return runner;
});

