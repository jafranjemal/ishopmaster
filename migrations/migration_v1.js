const mongoose = require("mongoose");
const SerializedStock = require("../models/SerializedStock");
const NonSerializedStock = require("../models/NonSerializedStock");
const Purchase = require("../models/Purchase");

async function migrateData() {
    console.log("🚀 Starting Data Migration v1...");

    try {
        // 1. Migrate SerializedStock
        console.log("📦 Migrating SerializedStock...");
        const serialResult = await SerializedStock.updateMany(
            { condition: { $exists: false } },
            {
                $set: {
                    condition: "Brand New",
                    previouslySold: false
                }
            }
        );
        console.log(`✅ SerializedStock: ${serialResult.modifiedCount} documents updated.`);

        // 2. Migrate NonSerializedStock
        console.log("📦 Migrating NonSerializedStock...");
        const nonSerialResult = await NonSerializedStock.updateMany(
            { condition: { $exists: false } },
            { $set: { condition: "Brand New" } }
        );
        console.log(`✅ NonSerializedStock: ${nonSerialResult.modifiedCount} documents updated.`);

        // 3. Migrate Purchase status
        console.log("📦 Migrating Purchase Status...");
        const purchaseResult = await Purchase.updateMany(
            { purchase_status: "Pending" },
            { $set: { purchase_status: "Pending Verification" } }
        );
        const purchaseReceivedResult = await Purchase.updateMany(
            { purchase_status: "Received" },
            { $set: { purchase_status: "Received" } } // Keep as is but ensure field exists if needed or backfill verification
        );
        console.log(`✅ Purchase: ${purchaseResult.modifiedCount + purchaseReceivedResult.modifiedCount} documents processed.`);

        console.log("✨ Migration v1 completed successfully.");
    } catch (error) {
        console.error("❌ Migration failed:", error);
    }
}

module.exports = migrateData;
