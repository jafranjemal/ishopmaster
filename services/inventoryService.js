const Item = require("../models/Items");
const ItemVariant = require("../models/ItemVariantSchema");
const SerializedStock = require("../models/SerializedStock");
const NonSerializedStock = require("../models/NonSerializedStock");
const StockLedger = require("../models/StockLedger");
const mongoose = require("mongoose");

/**
 * Syncs summary stock levels and pricing from detail records upward to Item/ItemVariant.
 */
exports.syncUpward = async (item_id, variant_id = null, session = null) => {
    try {
        const itemId = new mongoose.Types.ObjectId(item_id);
        const variantId = variant_id ? new mongoose.Types.ObjectId(variant_id) : null;

        // 1. Recalculate Stock Levels (Specific to Variant or Item)
        const nsMatch = variantId ? { item_id: itemId, variant_id: variantId } : { item_id: itemId };
        const sMatch = variantId ? { item_id: itemId, variant_id: variantId, status: "Available" } : { item_id: itemId, status: "Available" };

        const nsStock = await NonSerializedStock.aggregate([
            { $match: nsMatch },
            { $group: { _id: null, total: { $sum: "$availableQty" } } }
        ]).session(session);
        const nsTotal = nsStock.length > 0 ? nsStock[0].total : 0;
        const sTotal = await SerializedStock.countDocuments(sMatch).session(session);

        const grandTotal = nsTotal + sTotal;

        // 2. Get Last Pricing Data from detail records (Most recent batch)
        const lastNS = await NonSerializedStock.findOne(nsMatch).sort({ purchaseDate: -1 }).session(session).lean();
        const lastS = await SerializedStock.findOne(variantId ? { item_id: itemId, variant_id: variantId } : { item_id: itemId }).sort({ purchaseDate: -1 }).session(session).lean();

        let lastCost = 0;
        let lastPrice = 0;

        if (lastNS && lastS) {
            // Take the one with the newer purchase date
            const takeNS = new Date(lastNS.purchaseDate) >= new Date(lastS.purchaseDate);
            lastCost = takeNS ? lastNS.unitCost : lastS.unitCost;
            lastPrice = takeNS ? lastNS.sellingPrice : lastS.sellingPrice;
        } else if (lastNS) {
            lastCost = lastNS.unitCost;
            lastPrice = lastNS.sellingPrice;
        } else if (lastS) {
            lastCost = lastS.unitCost;
            lastPrice = lastS.sellingPrice;
        }

        // 3. Update Item Variant
        if (variantId) {
            await ItemVariant.findByIdAndUpdate(variantId, {
                $set: {
                    "stockTracking.currentStock": grandTotal,
                    "stockTracking.availableForSale": grandTotal,
                    "lastUnitCost": lastCost,
                    "defaultSellingPrice": lastPrice
                }
            }, { session });
        }

        // 4. Update Base Item Summary (Sum of all units)
        const itemNSTotalRes = await NonSerializedStock.aggregate([
            { $match: { item_id: itemId } },
            { $group: { _id: null, total: { $sum: "$availableQty" } } }
        ]).session(session);
        const itemSTotal = await SerializedStock.countDocuments({ item_id: itemId, status: "Available" }).session(session);
        const itemGrandTotal = (itemNSTotalRes.length > 0 ? itemNSTotalRes[0].total : 0) + itemSTotal;

        await Item.findByIdAndUpdate(itemId, {
            $set: {
                "stockTracking.currentStock": itemGrandTotal,
                "stockTracking.availableForSale": itemGrandTotal,
                "pricing.sellingPrice": lastPrice // Update base item price to match last variant price
            }
        }, { session });

    } catch (error) {
        console.error("[inventoryService] syncUpward failed:", error);
        throw error;
    }
};

/**
 * Standardized Stock Ledger Logging with correct balance logic.
 */
exports.logToLedger = async (data, session = null) => {
    const { item_id, variant_id, qty, movementType, batch_number, unitCost, sellingPrice, memo, serialNumber } = data;

    // Get absolute current balance for this Item/Variant combination from the LATEST ledger entry
    const lastEntry = await StockLedger.findOne({
        item_id: new mongoose.Types.ObjectId(item_id),
        variant_id: variant_id ? new mongoose.Types.ObjectId(variant_id) : null
    }).sort({ createdAt: -1 }).session(session).lean();

    const opening = lastEntry ? lastEntry.closing_balance : 0;
    const closing = opening + qty;

    const entry = new StockLedger({
        item_id,
        variant_id,
        movementType,
        qty,
        opening_balance: opening,
        closing_balance: closing,
        batch_number,
        unitCost,
        sellingPrice,
        memo,
        serialNumber,
        createdAt: new Date()
    });

    await entry.save({ session });
    return entry;
};
