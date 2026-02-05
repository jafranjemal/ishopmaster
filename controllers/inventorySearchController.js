const Item = require("../models/Items");
const ItemVariant = require("../models/ItemVariantSchema");
const SerializedStock = require("../models/SerializedStock");
const NonSerializedStock = require("../models/NonSerializedStock");
const { default: mongoose } = require("mongoose");

/**
 * High-performance search for POS items and variants.
 * Returns only the necessary data for POS cart operations.
 */
exports.posSearch = async (req, res) => {
    try {
        const { q, limit = 10, category } = req.query;
        const searchTerm = q ? q.trim() : "";
        const activeCategory = category && category !== 'All' ? category : null;
        const isInitial = !searchTerm;

        // --- TOKENIZED SEARCH LOGIC ---
        // Split by whitespace and filter out empty strings
        const tokens = searchTerm.split(/\s+/).filter(t => t.length > 0);

        // Create regex for each token
        const tokenRegexes = tokens.map(t => new RegExp(t, 'i'));

        // Helper for building the matching query
        const buildTokenQuery = (fieldName) => {
            if (tokens.length === 0) return {};
            if (tokens.length === 1) return { [fieldName]: tokenRegexes[0] };
            return { $and: tokenRegexes.map(r => ({ [fieldName]: r })) };
        };

        const variantSearchQuery = buildTokenQuery('variantName');
        const itemSearchQuery = buildTokenQuery('itemName');

        // 1. Parallel Search for Base Results
        let [serialMatch, variants, baseItems] = await Promise.all([
            !isInitial && (!activeCategory || activeCategory === 'Device')
                ? SerializedStock.findOne({ serialNumber: searchTerm, status: "Available" })
                    .populate('item_id')
                    .populate('variant_id')
                    .populate('warrantyPolicyId')
                    .lean()
                : null,

            ItemVariant.find({
                ...(isInitial ? {} : {
                    $or: [
                        variantSearchQuery,
                        { barcode: searchTerm },
                        { sku: searchTerm }
                    ]
                })
            }).populate({
                path: 'item_id',
                match: {
                    ...(activeCategory ? { category: activeCategory } : {}),
                    notForSelling: false
                }
            }).sort({ createdAt: -1 }).limit(parseInt(limit)).lean(),

            Item.find({
                ...(isInitial ? {} : {
                    $or: [
                        itemSearchQuery,
                        { barcode: searchTerm }
                    ]
                }),
                ...(activeCategory ? { category: activeCategory } : {}),
                notForSelling: false
            }).sort({ createdAt: -1 }).limit(parseInt(limit)).lean()
        ]);

        const uniqueResultsMap = new Map();
        const itemIds = new Set();
        const variantIds = new Set();
        const policyIds = new Set();

        // Collect IDs for bulk fetching
        if (serialMatch) {
            if (serialMatch.item_id) itemIds.add(serialMatch.item_id._id.toString());
            if (serialMatch.variant_id) variantIds.add(serialMatch.variant_id._id.toString());
            if (serialMatch.warrantyPolicyId) policyIds.add(serialMatch.warrantyPolicyId._id?.toString() || serialMatch.warrantyPolicyId.toString());
        }

        variants.forEach(v => {
            if (v.item_id && (!activeCategory || v.item_id.category === activeCategory)) {
                itemIds.add(v.item_id._id.toString());
                variantIds.add(v._id.toString());
            }
        });

        baseItems.forEach(i => {
            itemIds.add(i._id.toString());
        });

        // 2. Bulk Fetch Stocks and Policies
        const [nsStocks, sStocks] = await Promise.all([
            NonSerializedStock.find({
                item_id: { $in: Array.from(itemIds).map(id => new mongoose.Types.ObjectId(id)) },
                availableQty: { $gt: 0 }
            }).populate('purchase_id', 'referenceNumber purchasedItems').sort({ purchaseDate: -1 }).lean(),

            SerializedStock.find({
                item_id: { $in: Array.from(itemIds).map(id => new mongoose.Types.ObjectId(id)) },
                status: "Available"
            }).populate('purchase_id', 'referenceNumber').sort({ purchaseDate: -1 }).lean()
        ]);

        // Collect Policy IDs from stocks
        nsStocks.forEach(b => {
            if (b.purchase_id?.purchasedItems) {
                b.purchase_id.purchasedItems.forEach(pi => {
                    if (pi.warrantyPolicyId) policyIds.add(pi.warrantyPolicyId.toString());
                });
            }
        });
        sStocks.forEach(b => {
            if (b.warrantyPolicyId) policyIds.add(b.warrantyPolicyId.toString());
        });

        const WarrantyPolicy = mongoose.model("WarrantyPolicy");
        const policies = await WarrantyPolicy.find({ _id: { $in: Array.from(policyIds).map(id => new mongoose.Types.ObjectId(id)) } }).lean();
        const policiesMap = new Map(policies.map(p => [p._id.toString(), p]));

        // 3. In-Memory Grouping Logic
        const getStockData = (itemId, variantId) => {
            const ns = nsStocks.filter(s =>
                s.item_id.toString() === itemId.toString() &&
                (!variantId || (s.variant_id && s.variant_id.toString() === variantId.toString()))
            );
            const s = sStocks.filter(s =>
                s.item_id.toString() === itemId.toString() &&
                (!variantId || (s.variant_id && s.variant_id.toString() === variantId.toString()))
            );

            const batches = [];
            let totalStock = 0;
            let foundPolicyId = null;

            ns.forEach(b => {
                if (!foundPolicyId && b.purchase_id?.purchasedItems) {
                    const pi = b.purchase_id.purchasedItems.find(i =>
                        i.item_id.toString() === itemId.toString() &&
                        (!variantId || i.variant_id?.toString() === variantId.toString())
                    );
                    if (pi?.warrantyPolicyId) foundPolicyId = pi.warrantyPolicyId.toString();
                }
                batches.push({
                    batch_number: b.batch_number,
                    availableQty: b.availableQty,
                    unitCost: b.unitCost,
                    sellingPrice: b.sellingPrice,
                    purchaseDate: b.purchaseDate,
                    purchase_ref: b.purchase_id?.referenceNumber || "Direct"
                });
                totalStock += b.availableQty;
            });

            s.forEach(b => {
                if (!foundPolicyId && b.warrantyPolicyId) foundPolicyId = b.warrantyPolicyId.toString();
                batches.push({
                    batch_number: b.batch_number,
                    serialNumber: b.serialNumber,
                    availableQty: 1,
                    unitCost: b.unitCost,
                    sellingPrice: b.sellingPrice,
                    purchaseDate: b.purchaseDate,
                    purchase_ref: b.purchase_id?.referenceNumber || "Direct"
                });
                totalStock += 1;
            });

            batches.sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate));

            const activePrices = batches.map(b => b.sellingPrice).filter(p => p > 0);
            return {
                batches,
                totalStock,
                foundPolicyId,
                minPrice: activePrices.length > 0 ? Math.min(...activePrices) : 0,
                maxPrice: activePrices.length > 0 ? Math.max(...activePrices) : 0,
                hasPriceVariant: activePrices.length > 1 && Math.min(...activePrices) !== Math.max(...activePrices),
                latestPrice: batches[0]?.sellingPrice || 0
            };
        };

        const buildResult = (item, variant, stockData, isSerial = false) => {
            const policy = policiesMap.get(stockData.foundPolicyId);
            const finalPrice = stockData.latestPrice || (variant ? variant.defaultSellingPrice : (item.pricing?.sellingPrice || 0));

            return {
                _id: item._id,
                variant_id: variant?._id || null,
                itemName: variant ? variant.variantName : item.itemName,
                barcode: variant ? variant.barcode : item.barcode,
                isSerialized: variant ? (item.serialized || false) : (item.serialized || false),
                itemImage: (variant && variant.variantImage) || item.itemImage,
                lastSellingPrice: finalPrice,
                minPrice: stockData.minPrice,
                maxPrice: stockData.maxPrice,
                hasPriceVariant: stockData.hasPriceVariant,
                totalStock: stockData.totalStock,
                batches: stockData.batches,
                matchedSerial: isSerial ? searchTerm : undefined,
                ...(policy ? {
                    policy_name: policy.name,
                    phase1_days: policy.phase1_days,
                    phase2_days: policy.phase2_days,
                    terms_list: policy.terms_list,
                    warrantyPolicyId: policy._id
                } : {})
            };
        };

        // 4. Assemble Final Results
        if (serialMatch) {
            const stockData = getStockData(serialMatch.item_id._id, serialMatch.variant_id?._id);
            if (!stockData.foundPolicyId && serialMatch.warrantyPolicyId) {
                stockData.foundPolicyId = serialMatch.warrantyPolicyId._id?.toString() || serialMatch.warrantyPolicyId.toString();
            }
            const key = serialMatch.variant_id ? `v_${serialMatch.variant_id._id}` : `i_${serialMatch.item_id._id}`;
            uniqueResultsMap.set(key, buildResult(serialMatch.item_id, serialMatch.variant_id, stockData, true));
        }

        for (const v of variants) {
            if (!v.item_id) continue;
            const key = `v_${v._id}`;
            if (!uniqueResultsMap.has(key)) {
                const stockData = getStockData(v.item_id._id, v._id);
                if (isInitial && stockData.totalStock <= 0) continue;
                uniqueResultsMap.set(key, buildResult(v.item_id, v, stockData));
            }
        }

        for (const i of baseItems) {
            const key = `i_${i._id}`;
            const hasVariantsInResults = Array.from(uniqueResultsMap.values()).some(r => r._id.toString() === i._id.toString() && r.variant_id !== null);
            if (!uniqueResultsMap.has(key) && !hasVariantsInResults) {
                const stockData = getStockData(i._id, null);
                if (isInitial && stockData.totalStock <= 0) continue;
                uniqueResultsMap.set(key, buildResult(i, null, stockData));
            }
        }

        res.json(Array.from(uniqueResultsMap.values()));

    } catch (error) {
        console.error("[inventorySearchController] High-speed Search failed:", error);
        res.status(500).json({ error: "Search failed", details: error.message });
    }
};
