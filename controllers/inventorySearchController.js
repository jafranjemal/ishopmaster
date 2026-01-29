const Item = require("../models/Items");
const ItemVariant = require("../models/ItemVariantSchema");
const SerializedStock = require("../models/SerializedStock");
const NonSerializedStock = require("../models/NonSerializedStock");

/**
 * High-performance search for POS items and variants.
 * Returns only the necessary data for POS cart operations.
 */
exports.posSearch = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.json([]);

        const searchTerm = q.trim();
        const searchRegex = new RegExp(searchTerm, 'i');

        // 1. Parallel Search across Indices
        const [serialMatch, variants, baseItems] = await Promise.all([
            SerializedStock.findOne({ serialNumber: searchTerm, status: "Available" }).populate('item_id').populate('variant_id').lean(),
            ItemVariant.find({
                $or: [
                    { variantName: searchRegex },
                    { barcode: searchTerm },
                    { sku: searchTerm }
                ]
            }).populate('item_id').limit(10).lean(),
            Item.find({
                $or: [
                    { itemName: searchRegex },
                    { barcode: searchTerm }
                ]
            }).limit(10).lean()
        ]);

        const uniqueResultsMap = new Map();

        // Helper: Fetch batches and intelligently determine price + calculate real stock
        const fetchBatchesAndPrice = async (itemId, variantId, currentPrice) => {
            const [ns, s] = await Promise.all([
                NonSerializedStock.find({ item_id: itemId, variant_id: variantId, availableQty: { $gt: 0 } })
                    .populate('purchase_id', 'referenceNumber').sort({ purchaseDate: -1 }).lean(),
                SerializedStock.find({ item_id: itemId, variant_id: variantId, status: "Available" })
                    .populate('purchase_id', 'referenceNumber').sort({ purchaseDate: -1 }).lean()
            ]);

            const batches = [];
            let calculatedStock = 0; // Calculate real stock from batches

            ns.forEach(b => {
                batches.push({
                    batch_number: b.batch_number,
                    availableQty: b.availableQty,
                    unitCost: b.unitCost,
                    sellingPrice: b.sellingPrice,
                    purchaseDate: b.purchaseDate,
                    purchase_ref: b.purchase_id?.referenceNumber || "Direct"
                });
                calculatedStock += b.availableQty; // Sum non-serialized quantities
            });

            s.forEach(b => {
                batches.push({
                    batch_number: b.batch_number,
                    serialNumber: b.serialNumber,
                    availableQty: 1,
                    unitCost: b.unitCost,
                    sellingPrice: b.sellingPrice,
                    purchaseDate: b.purchaseDate,
                    purchase_ref: b.purchase_id?.referenceNumber || "Direct"
                });
                calculatedStock += 1; // Each serialized item = 1
            });

            // 🧠 INTELLIGENT PRICE FALLBACK
            let finalPrice = currentPrice || 0;
            let needsAutoFix = false;

            if (finalPrice <= 0 && batches.length > 0) {
                const recentBatch = batches[0];
                finalPrice = recentBatch.sellingPrice || recentBatch.unitCost || 0;
                needsAutoFix = finalPrice > 0;
            }

            return { batches, finalPrice, needsAutoFix, calculatedStock };
        };

        // AUTO-FIX: Update Item/Variant with discovered price
        const autoFixPrice = async (itemId, variantId, price) => {
            try {
                if (variantId) {
                    await ItemVariant.findByIdAndUpdate(variantId, {
                        $set: { defaultSellingPrice: price }
                    });
                    console.log(`✅ AUTO-FIXED Variant ${variantId} price: ${price}`);
                } else {
                    await Item.findByIdAndUpdate(itemId, {
                        $set: { 'pricing.sellingPrice': price }
                    });
                    console.log(`✅ AUTO-FIXED Item ${itemId} price: ${price}`);
                }
            } catch (err) {
                console.error("Auto-fix price failed:", err);
            }
        };

        // Process Serial Match (Highest Priority)
        if (serialMatch) {
            const item = serialMatch.item_id;
            const variant = serialMatch.variant_id;
            const key = variant ? `v_${variant._id}` : `i_${item._id}`;

            const currentPrice = variant ? variant.defaultSellingPrice : (item.pricing?.sellingPrice || 0);
            const { batches, finalPrice, needsAutoFix, calculatedStock } = await fetchBatchesAndPrice(item._id, variant?._id || null, currentPrice);

            if (needsAutoFix) {
                await autoFixPrice(item._id, variant?._id || null, finalPrice);
            }

            uniqueResultsMap.set(key, {
                _id: item._id,
                variant_id: variant?._id || null,
                itemName: variant ? variant.variantName : item.itemName,
                barcode: variant ? variant.barcode : item.barcode,
                isSerialized: true,
                itemImage: (variant && variant.variantImage) || item.itemImage,
                lastSellingPrice: finalPrice,
                totalStock: calculatedStock,
                batches: batches,
                matchedSerial: searchTerm
            });
        }

        // Process Variants
        for (const v of variants) {
            const key = `v_${v._id}`;
            if (!uniqueResultsMap.has(key)) {
                const currentPrice = v.defaultSellingPrice || 0;
                const { batches, finalPrice, needsAutoFix, calculatedStock } = await fetchBatchesAndPrice(v.item_id?._id || v.item_id, v._id, currentPrice);

                if (needsAutoFix) {
                    await autoFixPrice(v.item_id?._id || v.item_id, v._id, finalPrice);
                }

                uniqueResultsMap.set(key, {
                    _id: v.item_id?._id || v.item_id,
                    variant_id: v._id,
                    itemName: v.variantName,
                    barcode: v.barcode,
                    isSerialized: v.item_id?.serialized || false,
                    itemImage: v.variantImage || v.item_id?.itemImage,
                    lastSellingPrice: finalPrice,
                    totalStock: calculatedStock,
                    batches: batches
                });
            }
        }

        // Process Base Items (skip if item already has variants in results to prevent duplicates)
        for (const item of baseItems) {
            const key = `i_${item._id}`;

            // Check if this base item already has variants in our results
            const hasVariantsInResults = Array.from(uniqueResultsMap.values()).some(
                r => r._id.toString() === item._id.toString() && r.variant_id !== null
            );

            if (!uniqueResultsMap.has(key) && !hasVariantsInResults) {
                const currentPrice = item.pricing?.sellingPrice || item.costPrice || 0;
                const { batches, finalPrice, needsAutoFix, calculatedStock } = await fetchBatchesAndPrice(item._id, null, currentPrice);

                if (needsAutoFix) {
                    await autoFixPrice(item._id, null, finalPrice);
                }

                uniqueResultsMap.set(key, {
                    _id: item._id,
                    variant_id: null,
                    itemName: item.itemName,
                    barcode: item.barcode,
                    isSerialized: item.serialized || false,
                    itemImage: item.itemImage,
                    lastSellingPrice: finalPrice,
                    totalStock: calculatedStock,
                    batches: batches
                });
            }
        }

        res.json(Array.from(uniqueResultsMap.values()));

    } catch (error) {
        console.error("[inventorySearchController] High-speed Search failed:", error);
        res.status(500).json({ error: "Search failed", details: error.message });
    }
};
