const Item = require("../models/Items");
const ItemVariant = require("../models/ItemVariantSchema");
const SerializedStock = require("../models/SerializedStock");
const NonSerializedStock = require("../models/NonSerializedStock");

/**
 * Recalculates and updates the summary stock levels for a specific item and variant.
 * 
 * @param {string} item_id - The ID of the base item.
 * @param {string} variant_id - The ID of the item variant (if any).
 */
exports.syncStockLevels = async (item_id, variant_id = null) => {
    try {
        console.log(`[stockSyncService] Syncing stock for item: ${item_id}, variant: ${variant_id}`);

        // 1. Calculate Non-Serialized Stock (Sum of availableQty)
        const nsQuery = { item_id };
        if (variant_id) nsQuery.variant_id = variant_id;

        const nsStock = await NonSerializedStock.aggregate([
            { $match: nsQuery },
            { $group: { _id: null, total: { $sum: "$availableQty" } } }
        ]);
        const nsTotal = nsStock.length > 0 ? nsStock[0].total : 0;

        // 2. Calculate Serialized Stock (Count of Available status)
        const sQuery = { item_id, status: "Available" };
        if (variant_id) sQuery.variant_id = variant_id;

        const sTotal = await SerializedStock.countDocuments(sQuery);

        const grandTotal = nsTotal + sTotal;

        // 3. Update Item Variant (if applicable)
        if (variant_id) {
            await ItemVariant.findByIdAndUpdate(variant_id, {
                $set: {
                    "stockTracking.currentStock": grandTotal,
                    "stockTracking.availableForSale": grandTotal
                }
            });
        }

        // 4. Update Base Item Summary
        // For the base item, we should sum across ALL its variants
        const itemNSStock = await NonSerializedStock.aggregate([
            { $match: { item_id: require('mongoose').Types.ObjectId(item_id) } },
            { $group: { _id: null, total: { $sum: "$availableQty" } } }
        ]);
        const itemSStock = await SerializedStock.countDocuments({ item_id, status: "Available" });

        const itemGrandTotal = (itemNSStock.length > 0 ? itemNSStock[0].total : 0) + itemSStock;

        await Item.findByIdAndUpdate(item_id, {
            $set: {
                "stockTracking.currentStock": itemGrandTotal,
                "stockTracking.availableForSale": itemGrandTotal
            }
        });

        console.log(`[stockSyncService] Sync complete. Item Total: ${itemGrandTotal}, Variant Total: ${grandTotal}`);

    } catch (error) {
        console.error(`[stockSyncService] Sync failed for ${item_id}:`, error);
        // We don't throw to prevent blocking the main transaction, but log strictly
    }
};
