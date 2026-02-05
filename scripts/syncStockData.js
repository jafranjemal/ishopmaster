const path = require("path");
const Purchase = require(path.join(__dirname, "../models/Purchase"));
const NonSerializedStock = require(path.join(__dirname, "../models/NonSerializedStock"));
require("dotenv").config();

async function syncStockData() {
    try {
        const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/ishopmaster";
        await mongoose.connect(mongoUri);
        console.log("Connected to MongoDB.");

        // 1. Fix missing conditions (Legacy Data Cleanup)
        console.log("Setting default condition for legacy records...");
        const conditionResult = await NonSerializedStock.updateMany(
            { condition: { $exists: false } },
            { $set: { condition: "Brand New" } }
        );
        console.log(`Legacy Conditions: Matched ${conditionResult.matchedCount}, Modified ${conditionResult.modifiedCount}`);

        // 2. Fix specific Purchase Mismatch (Purchase 6981d2a159c69be2385916b1)
        const purchaseId = "6981d2a159c69be2385916b1";
        const purchase = await Purchase.findById(purchaseId);

        if (purchase) {
            console.log(`Processing Purchase Mismatch: ${purchase.referenceNumber}`);
            for (const item of purchase.purchasedItems) {
                if (!item.isSerialized) {
                    const result = await NonSerializedStock.updateMany(
                        {
                            purchase_id: purchaseId,
                            item_id: item.item_id,
                            variant_id: item.variant_id || null
                        },
                        {
                            $set: {
                                sellingPrice: item.sellingPrice,
                                unitCost: item.unitCost,
                                condition: item.condition || "Brand New"
                            }
                        }
                    );
                    console.log(`Mismatch Fix [${item.variant_id || 'Base'}]: Matched ${result.matchedCount}, Modified ${result.modifiedCount}`);
                }
            }
        } else {
            console.warn("Target purchase for mismatch fix not found.");
        }

        console.log("Synchronization complete.");
    } catch (err) {
        console.error("Error during sync:", err);
    } finally {
        await mongoose.disconnect();
    }
}

syncStockData();
