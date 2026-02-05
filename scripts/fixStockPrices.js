const mongoose = require("mongoose");
const Purchase = require("../models/Purchase");
const NonSerializedStock = require("../models/NonSerializedStock");

require("dotenv").config();

async function fixStockPrices() {
    try {
        // const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/ishopmaster";
        const mongoUri = 'mongodb+srv://jafranjemal:jafran123@cluster0.yai9p.mongodb.net/ishopmaster?retryWrites=true&w=majority'

        await mongoose.connect(mongoUri);
        console.log("Connected to MongoDB.");

        const purchaseId = "6981d2a159c69be2385916b1";
        const purchase = await Purchase.findById(purchaseId);

        if (!purchase) {
            console.error("Purchase not found.");
            return;
        }

        console.log(`Processing Purchase: ${purchase.referenceNumber}`);

        for (const item of purchase.purchasedItems) {
            if (!item.isSerialized) {
                console.log(`Updating Item: ${item.item_id}, Variant: ${item.variant_id || 'Base'} -> Price: ${item.sellingPrice}, Cost: ${item.unitCost}`);

                const result = await NonSerializedStock.updateMany(
                    {
                        purchase_id: purchaseId,
                        item_id: item.item_id,
                        variant_id: item.variant_id || null
                    },
                    {
                        $set: {
                            sellingPrice: item.sellingPrice,
                            unitCost: item.unitCost
                        }
                    }
                );

                console.log(`Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
            }
        }

        console.log("Cleanup complete.");
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await mongoose.disconnect();
    }
}

fixStockPrices();
