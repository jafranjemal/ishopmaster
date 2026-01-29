// No legacy Stock model needed. Using SerializedStock and NonSerializedStock.
const Item = require("../models/Items");
const mongoose = require("mongoose");
const moment = require("moment"); // To calculate the stock age (optional)
const NonSerializedStock = require("../models/NonSerializedStock");
const SerializedStock = require("../models/SerializedStock");
const Items = require("../models/Items");
const ItemVariant = require("../models/ItemVariantSchema");
const StockLedger = require("../models/StockLedger");
const Purchase = require("../models/Purchase");
const SalesInvoice = require("../models/SalesInvoice");
const Account = require("../models/Account");
const Transaction = require("../models/Transaction");
const AuditLog = require("../models/AuditLog");

exports.getItemStockDetails = async (req, res) => {
  try {
    const { itemId } = req.params;

    // Validate itemId
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ message: "Invalid itemId format" });
    }

    // Check if the item exists and get its serialized status
    const item = await Items.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    let stockDetails = [];

    if (item.serialized) {
      // Fetch serialized stock details
      stockDetails = await SerializedStock.aggregate([
        {
          $match: { item_id: new mongoose.Types.ObjectId(itemId) },
        },
        {
          $group: {
            _id: "$item_id",
            totalStock: {
              $sum: { $cond: [{ $eq: ["$status", "Available"] }, 1, 0] },
            },
            soldQty: { $sum: { $cond: [{ $eq: ["$status", "Sold"] }, 1, 0] } },
            adjustmentQty: {
              $sum: { $cond: [{ $eq: ["$status", "Damaged"] }, 1, 0] },
            },
            unitCost: { $first: "$unitCost" },
            sellingPrice: { $first: "$sellingPrice" },

            expiryDate: { $first: "$expiryDate" },
            batches: {
              $push: {
                batch_number: "$batch_number",
                serialNumber: "$serialNumber",
                purchaseDate: "$purchaseDate",
                unitCost: "$unitCost",
                sellingPrice: "$sellingPrice",
                purchaseDate: "$purchaseDate",
                purchase_id: "$purchase_id",
              },
            },
          },
        },
      ]);
    } else {
      // Fetch non-serialized stock details
      stockDetails = await NonSerializedStock.aggregate([
        {
          $match: {
            item_id: new mongoose.Types.ObjectId(itemId),
            status: "Available"
          },
        },
        {
          $group: {
            _id: "$item_id",
            totalStock: { $sum: "$availableQty" },
            soldQty: { $sum: "$soldQty" },
            soldQty: { $sum: "$soldQty" },
            adjustmentQty: { $sum: "$adjustmentQty" },
            unitCost: { $first: "$unitCost" },
            sellingPrice: { $first: "$sellingPrice" },
            expiryDate: { $first: "$expiry_date" },
            batches: {
              $push: {
                batch_number: "$batch_number",
                availableQty: "$availableQty",
                unitCost: "$unitCost",
                purchaseDate: "$purchaseDate",
                purchase_id: "$purchase_id",
                sellingPrice: "$sellingPrice",
              },
            },
          },
        },
      ]);
    }

    // Respond with stock details
    return res.status(200).json({
      ...item.toObject(),
      stockDetails: stockDetails[0],
    });
  } catch (error) {
    console.error("Error fetching stock details:", error);
    return res.status(500).json({
      message: "An error occurred while fetching stock details",
      error: error.message,
    });
  }
};

// exports.createStock = ... // Legacy, officially using Purchase/Adjustment
// Get stock of an item by its ID
// exports.getStockByItem = ... // Legacy

// Update stock quantity when items are sold
// exports.updateStockOnSale = ... // Legacy, using Sales-integrated stock reduction now

// Get the current stock value (unit cost * available qty) of all items
exports.getCurrentStockValue = async (req, res) => {
  try {
    const [serialized, nonSerialized] = await Promise.all([
      SerializedStock.find({ status: "Available" }),
      NonSerializedStock.find({ status: "Available" })
    ]);

    let totalValue = 0;
    serialized.forEach(s => totalValue += (s.unitCost || 0));
    nonSerialized.forEach(n => totalValue += (n.availableQty * (n.unitCost || 0)));

    return res.status(200).json({ totalStockValue: totalValue });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error calculating stock value" });
  }
};

// Get stock by batch number for item
exports.getStockByBatch = async (req, res) => {
  try {
    const { item_id, batch_number } = req.params;

    const [serialized, nonSerialized] = await Promise.all([
      SerializedStock.findOne({ item_id, batch_number }),
      NonSerializedStock.findOne({ item_id, batch_number })
    ]);

    const stock = serialized || nonSerialized;
    if (!stock) {
      return res.status(404).json({ message: "Stock not found for this batch" });
    }

    return res.status(200).json(stock);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error fetching stock by batch" });
  }
};

// exports.getAllItemsWithStock_old = ... // Deprecated

exports.getAllItemsWithStock = async (req, res) => {
  try {
    const [nonSerialized, serialized] = await Promise.all([
      NonSerializedStock.aggregate([
        { $match: { status: "Available", availableQty: { $gt: 0 } } },
        { $lookup: { from: "items", localField: "item_id", foreignField: "_id", as: "itemDetails" } },
        { $unwind: "$itemDetails" },
        { $lookup: { from: "purchases", localField: "purchase_id", foreignField: "_id", as: "purchaseDetails" } },
        { $unwind: { path: "$purchaseDetails", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: "$item_id",
            totalStock: { $sum: "$availableQty" },
            lastUnitCost: { $last: "$unitCost" },
            lastSellingPrice: { $last: "$sellingPrice" },
            maxPurchaseDate: { $max: "$purchaseDate" },
            batches: {
              $push: {
                batch_number: "$batch_number",
                availableQty: "$availableQty",
                purchaseDate: "$purchaseDate",
                unitCost: "$unitCost",
                sellingPrice: "$sellingPrice",
                invoiceNumber: { $ifNull: ["$purchaseDetails.referenceNumber", ""] }
              }
            },
            itemDetails: { $first: "$itemDetails" }
          }
        }
      ]),
      SerializedStock.aggregate([
        { $match: { status: "Available" } },
        { $lookup: { from: "items", localField: "item_id", foreignField: "_id", as: "itemDetails" } },
        { $unwind: "$itemDetails" },
        { $lookup: { from: "purchases", localField: "purchase_id", foreignField: "_id", as: "purchaseDetails" } },
        { $unwind: { path: "$purchaseDetails", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: "$item_id",
            totalStock: { $sum: 1 },
            lastUnitCost: { $last: "$unitCost" },
            lastSellingPrice: { $last: "$sellingPrice" },
            maxPurchaseDate: { $max: "$purchaseDate" },
            batches: {
              $push: {
                batch_number: "$batch_number",
                serialNumber: "$serialNumber",
                availableQty: 1,
                purchaseDate: "$purchaseDate",
                unitCost: "$unitCost",
                sellingPrice: "$sellingPrice",
                invoiceNumber: { $ifNull: ["$purchaseDetails.referenceNumber", ""] }
              }
            },
            itemDetails: { $first: "$itemDetails" }
          }
        }
      ])
    ]);

    // Merge results from both models
    const merged = [...nonSerialized, ...serialized].map(item => {
      const batchDetails = item.batches.map(batch => ({
        ...batch,
        ageInDays: moment().diff(moment(batch.purchaseDate), "days"),
        purchaseDate: moment(batch.purchaseDate).format("YYYY-MM-DD")
      }));

      return {
        ...item.itemDetails,
        totalStock: item.totalStock,
        batches: batchDetails,
        lastUnitCost: item.lastUnitCost,
        lastSellingPrice: item.lastSellingPrice,
        serialized: item.itemDetails.serialized,

      };
    });

    res.json(merged.sort((a, b) => new Date(b.maxPurchaseDate) - new Date(a.maxPurchaseDate)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching items and stock", error: err.message });
  }
};

exports.getRestockSuggestions_legacy = async (req, res) => {
  try {
    // 1. Dual Query: Find Low Stock Base Items AND Variants
    const [lowStockItems, lowStockVariants] = await Promise.all([
      Items.find({
        $expr: { $lte: ["$stockTracking.availableForSale", "$stockTracking.reorderPoint"] },
        // category: { $ne: "Device" } // Optional: Exclude devices if they should only be tracked via variants
      })
        .populate("stockTracking.preferredSupplier", "business_name contact_info")
        .lean(),

      ItemVariant.find({
        $expr: { $lte: ["$stockTracking.availableForSale", "$stockTracking.reorderPoint"] }
      })
        .populate("item_id", "itemName category itemImage")
        .populate("stockTracking.preferredSupplier", "business_name contact_info")
        .lean()
    ]);

    // 2. Normalize Data Structure
    const allSuggestions = [
      ...lowStockItems.map(i => ({ ...i, isVariant: false, variant_id: null })),
      ...lowStockVariants
        .filter(v => v.item_id) // Safety filter for orphaned variants
        .map(v => ({
          ...v,
          _id: v.item_id._id, // Mapped to Base Item ID for consistent linking
          variant_id: v._id,
          itemName: `${v.item_id.itemName} - ${v.variantName}`,
          itemImage: v.variantImage || v.item_id.itemImage,
          category: v.item_id.category,
          costPrice: v.lastUnitCost,
          isVariant: true,
          pricing: { sellingPrice: v.defaultSellingPrice }
        }))
    ];

    if (allSuggestions.length === 0) {
      return res.status(200).json([]);
    }

    // 3. Enrich with Historical Supplier/Agent
    const enrichedItems = await Promise.all(allSuggestions.map(async (item) => {
      let supplierId = item.stockTracking?.preferredSupplier?._id;
      let supplierName = item.stockTracking?.preferredSupplier?.business_name;
      let agentId = null;
      let agentName = "";

      if (!supplierId) {
        // Find last purchase
        const query = { "purchasedItems.item_id": item._id };
        if (item.isVariant) query["purchasedItems.variant_id"] = item.variant_id;

        const lastPurchase = await Purchase.findOne(query)
          .sort({ purchaseDate: -1 })
          .populate("supplier", "business_name")
          .lean();

        if (lastPurchase) {
          supplierId = lastPurchase.supplier?._id;
          supplierName = lastPurchase.supplier?.business_name;
          agentId = lastPurchase.ref_agent_id;
          agentName = lastPurchase.ref_agent_name;
        }
      }

      return {
        ...item,
        suggestedSupplierId: supplierId || "unassigned",
        suggestedSupplierName: supplierName || "Unassigned / New Supplier",
        suggestedAgentId: agentId || "direct",
        suggestedAgentName: agentName || "Direct / Primary"
      };
    }));

    // 4. THE GHOST FILTER (Exclude Orphans)
    // Remove items that have NO Preferred Supplier AND NO Purchase History
    const validItems = enrichedItems.filter(item => {
      // Keep if user explicitly set a preferred supplier (Strong Intent)
      if (item.stockTracking?.preferredSupplier) return true;

      // Keep if we found a historical supplier from previous purchases (Proven History)
      if (item.suggestedSupplierId !== "unassigned") return true;

      // Otherwise, it's a "Ghost Item" (Never bought, no config) -> DROP IT
      return false;
    });

    // 5. Group by Supplier + Agent Combo
    const grouped = validItems.reduce((acc, item) => {
      const sId = item.suggestedSupplierId.toString();
      const aId = item.suggestedAgentId.toString();
      const groupKey = `${sId}_${aId}`;

      if (!acc[groupKey]) {
        acc[groupKey] = {
          supplierId: sId === "unassigned" ? null : sId,
          supplierName: item.suggestedSupplierName,
          agentId: aId === "direct" ? null : aId,
          agentName: item.suggestedAgentName,
          items: []
        };
      }
      acc[groupKey].items.push(item);
      return acc;
    }, {});

    res.status(200).json(Object.values(grouped));
  } catch (err) {
    console.error("🔥 getRestockSuggestions ERROR:", err);
    res.status(500).json({ message: "Error fetching suggestions", error: err.message });
  }
};


exports.getRestockSuggestions = async (req, res) => {
  try {
    // 1. BROAD SEARCH CRITERIA (Capture potential low stock via Cache or Legacy fields)
    const thresholdExpr = {
      $cond: [
        { $gt: [{ $ifNull: ["$stockTracking.reorderPoint", 0] }, 0] },
        "$stockTracking.reorderPoint",
        { $convert: { input: "$alertQuantity", to: "double", onError: 0, onNull: 0 } }
      ]
    };

    const searchCriteria = {
      $expr: {
        $let: {
          vars: { threshold: thresholdExpr },
          in: {
            $and: [
              { $gt: ["$$threshold", 0] },
              {
                $lte: [
                  { $ifNull: ["$stockTracking.availableForSale", { $ifNull: ["$availableQty", 0] }] },
                  "$$threshold"
                ]
              }
            ]
          }
        }
      }
    };

    // 2. FETCH CANDIDATES
    const [baseItems, variants] = await Promise.all([
      Item.find(searchCriteria).populate("stockTracking.preferredSupplier").lean(),
      ItemVariant.find(searchCriteria).populate("item_id").populate("stockTracking.preferredSupplier").lean()
    ]);

    const itemIds = [...new Set([...baseItems.map(i => i._id), ...variants.map(v => v.item_id?._id)].filter(Boolean))];

    // 3. BULK AGGREGATE REAL-TIME TRUTH (The "Laser" Fix for 0 vs 1 issues)
    const [serStock, nonSerStock] = await Promise.all([
      SerializedStock.aggregate([
        { $match: { item_id: { $in: itemIds }, status: { $in: ["Available", "On Hold", "Damaged", "Reserved"] } } },
        {
          $group: {
            _id: { i: "$item_id", v: { $ifNull: ["$variant_id", null] } },
            available: { $sum: { $cond: [{ $eq: ["$status", "Available"] }, 1, 0] } },
            physical: { $sum: 1 }
          }
        }
      ]),


      NonSerializedStock.aggregate([
        { $match: { item_id: { $in: itemIds }, availableQty: { $gt: 0 } } },
        {
          $group: {
            _id: { i: "$item_id", v: { $ifNull: ["$variant_id", null] } },
            totalAvailable: { $sum: "$availableQty" }
          }
        }
      ])
    ]);

    const stockMap = new Map();
    // Explicit stringification of keys to prevent lookup failure
    serStock.forEach(s => {
      const key = `${s._id.i.toString()}_${s._id.v ? s._id.v.toString() : "null"}`;
      stockMap.set(key, { a: s.available, p: s.physical });
    });

    nonSerStock.forEach(n => {
      const key = `${n._id.i.toString()}_${n._id.v ? n._id.v.toString() : "null"}`; // issue fixed:The "zero stock" discrepancy is caused by ObjectId vs. String mismatches in the Map keys and incorrect property access on populated objects.
      const existing = stockMap.get(key) || { a: 0, p: 0 };
      stockMap.set(key, { a: existing.a + n.totalAvailable, p: existing.p + n.totalAvailable });
    });

    // 4. NORMALIZE & FINAL FILTER
    const allCandidates = [...baseItems.map(i => ({ ...i, type: 'BASE' })), ...variants.map(v => ({ ...v, type: 'VARIANT' }))];

    const suggestions = allCandidates.map(c => {
      // Correct ID extraction: variants have item_id object, base has _id
      const iId = (c.type === 'BASE' ? c._id : (c.item_id?._id || c.item_id))?.toString();
      const vId = (c.type === 'VARIANT' ? c._id.toString() : "null");
      if (!iId) return null;
      const realStock = stockMap.get(`${iId}_${vId}`) || { a: 0, p: 0 };

      const threshold = c.stockTracking?.reorderPoint > 0
        ? c.stockTracking.reorderPoint
        : parseFloat(c.alertQuantity || 0);

      if (realStock.a > threshold) return null; // Filter out false positives from stale cache

      return {
        ...c,
        calculatedStock: { available: realStock.a, physical: realStock.p, threshold },
        totalStock: realStock.p,
        stockTracking: {
          ...c.stockTracking,
          availableForSale: realStock.a,
          currentStock: realStock.p,
          reorderPoint: threshold
        },
        targetQty: Math.max(0, (threshold * 2) - realStock.a)
      };
    }).filter(Boolean);

    // 5. SUPPLIER & AGENT RESOLUTION (Optimized for performance)
    const itemsNeedingHistory = suggestions.filter(i => !i.stockTracking?.preferredSupplier);
    const historyMap = {};

    if (itemsNeedingHistory.length > 0) {
      const variantIds = itemsNeedingHistory.filter(i => i.type === 'VARIANT').map(i => new mongoose.Types.ObjectId(i._id));
      const baseIds = itemsNeedingHistory.filter(i => i.type === 'BASE').map(i => new mongoose.Types.ObjectId(i._id));

      const recentPurchases = await Purchase.find({
        $or: [
          { "purchasedItems.variant_id": { $in: variantIds } },
          { "purchasedItems.item_id": { $in: baseIds } }
        ]
      })
        .sort({ purchaseDate: -1 })
        .limit(500)
        .populate("supplier", "business_name contact_info contacts")
        .lean();

      itemsNeedingHistory.forEach(item => {
        const idToMatch = item._id.toString();
        const match = recentPurchases.find(p =>
          p.purchasedItems.some(pi => {
            if (item.type === 'VARIANT') return pi.variant_id?.toString() === idToMatch;
            return pi.item_id?.toString() === idToMatch && !pi.variant_id;
          })
        );
        if (match) historyMap[idToMatch] = match;
      });
    }

    const groupedResult = suggestions.reduce((acc, item) => {
      let supplierId, supplierName, agentId, agentName, contactNumber, agentContact = "";
      const prefSup = item.stockTracking?.preferredSupplier;

      // Priority 1: Preferred Supplier from Master Data
      if (prefSup) {
        supplierId = prefSup._id;
        supplierName = prefSup.business_name;
        contactNumber = prefSup.contact_info?.contact_number;
        agentId = item.stockTracking?.preferredAgentId || "direct";
        agentName = "Direct / Primary";
        if (agentId !== "direct" && prefSup.contacts) {
          const agent = prefSup.contacts.find(c => c._id?.toString() === agentId.toString());
          if (agent) {
            agentName = agent.name;
            agentContact = agent.phone;
          }
        }
      }
      // Priority 2: Supplier from Purchase History
      else {
        const lastPurchase = historyMap[item._id.toString()];
        if (lastPurchase) {
          supplierId = lastPurchase.supplier?._id;
          supplierName = lastPurchase.supplier?.business_name;
          contactNumber = lastPurchase.supplier?.contact_info?.contact_number;
          agentId = lastPurchase.ref_agent_id || "direct";
          agentName = lastPurchase.ref_agent_name || "Direct / Primary";
          if (agentId !== "direct" && lastPurchase.supplier?.contacts) {
            const agent = lastPurchase.supplier.contacts.find(c => c._id?.toString() === agentId.toString());
            agentContact = agent?.phone || "";
          }
        }
      }

      if (supplierId) {
        const sIdStr = supplierId.toString();
        const aIdStr = agentId.toString();
        const groupKey = `${sIdStr}_${aIdStr}`;

        if (!acc[groupKey]) {
          acc[groupKey] = {
            supplierId: sIdStr,
            supplierName: supplierName || "Unknown",
            supplierContact: contactNumber || "",
            agentId: aIdStr === "direct" ? null : aIdStr,
            agentName,
            contactNumber: agentContact || contactNumber || "",
            items: []
          };
        }

        // Normalize naming for Variants vs Base Items
        let displayName = item.type === 'VARIANT' ? item.variantName : item.itemName;
        displayName = displayName || "Unnamed Item";

        if (item.type === 'VARIANT' && item.item_id) {
          const baseName = item.item_id.itemName || "";
          if (baseName && !displayName.toLowerCase().startsWith(baseName.toLowerCase())) {
            displayName = `${baseName} - ${displayName}`;
          }
        }

        acc[groupKey].items.push({
          ...item,
          itemName: displayName,
          targetQty: Math.max(0, (item.calculatedStock.threshold * 2) - item.calculatedStock.available)
        });
      }
      return acc;
    }, {});

    res.status(200).json(Object.values(groupedResult));
  } catch (err) {
    console.error("🔥 getRestockSuggestions ERROR:", err);
    res.status(500).json({ message: "Error fetching suggestions", error: err.message });
  }
};

// Stock Controller - Get stock for a single item
exports.getStockForItem = async (req, res) => {
  const { item_id } = req.params;
  console.log({ item_id });
  try {
    if (!mongoose.Types.ObjectId.isValid(item_id)) {
      throw new Error("Invalid item_id");
    }

    // Fetch stock data from both models
    const [serializedStock, nonSerializedStock] = await Promise.all([
      SerializedStock.aggregate([
        { $match: { item_id: new mongoose.Types.ObjectId(item_id), status: "Available" } },
        { $group: { _id: "$item_id", total: { $sum: 1 } } }
      ]),
      NonSerializedStock.aggregate([
        { $match: { item_id: new mongoose.Types.ObjectId(item_id), status: "Available" } },
        { $group: { _id: "$item_id", total: { $sum: "$availableQty" } } }
      ])
    ]);

    const totalStock = (serializedStock[0]?.total || 0) + (nonSerializedStock[0]?.total || 0);
    res.json({ item_id, totalStock });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching stock for item" });
  }
};

// Controller to get stock by purchase ID
// exports.getStockByPurchaseId_old = ... // Legacy

// Controller to get stock by purchase ID
exports.getStockByPurchaseId = async (req, res) => {
  try {
    const { purchaseId } = req.params;

    // Fetch non-serialized stock details
    const nonSerializedStocks1 = await NonSerializedStock.find(
      { purchase_id: purchaseId },
      {
        item_id: 1,
        batch_number: 1,
        purchaseDate: 1,
        purchaseQty: 1,
        availableQty: 1,
        soldQty: 1,
        adjustmentQty: 1,
        unitCost: 1,
        sellingPrice: 1,
        expiryDate: 1,
        adjustmentReason: 1,
      }
    );

    // item_id: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    // purchase_id: { type: mongoose.Schema.Types.ObjectId, ref: "Purchase", required: true },
    // batch_number: { type: String, required: true }, // Unique for batch
    // purchaseQty: { type: Number, required: true }, // Total quantity purchased
    // availableQty: { type: Number, required: true }, // Remaining stock
    // soldQty: { type: Number, default: 0 }, // Quantity sold
    // adjustmentQty: { type: Number, default: 0 }, // Adjustments for returns, damages
    // unitCost: { type: Number, required: true }, // Purchase price per unit
    // beforePurchaseAvailableQty: { type: Number, required: false, default:0 }, // Purchase price per unit
    // sellingPrice: { type: Number, required: true }, // Selling price per unit
    // expiryDate: { type: Date }, // Optional: Expiry date for consumables
    // adjustmentReason: { type: String }, // Optional: Reason for adjustment
    // unit: { type: String }, // Optional: Reason for adjustment
    // purchaseDate: { type: Date, required: true },
    const nonSerializedStocks = await NonSerializedStock.aggregate([
      { $match: { purchase_id: new mongoose.Types.ObjectId(purchaseId) } },
      {
        $lookup: {
          from: "items", // Replace "items" with the actual name of your items collection
          localField: "item_id",
          foreignField: "_id",
          as: "itemDetails",
        },
      },
      {
        $unwind: "$itemDetails",
      },
      {
        $group: {
          _id: "$item_id",
          totalStock: { $sum: "$availableQty" }, // Sum of availableQty
          beforePurchaseAvailableQty: { $last: "$beforePurchaseAvailableQty" }, // Sum of availableQty
          purchaseQty: { $last: "$purchaseQty" }, // Sum of availableQty
          purchaseDate: { $last: "$purchaseDate" }, // Sum of availableQty
          batch_number: { $last: "$batch_number" },
          lastUnitCost: { $last: "$unitCost" }, // Count of available serialized items
          soldQty: { $sum: "$soldQty" },
          adjustmentQty: { $sum: "$adjustmentQty" },
          sellingPrice: { $sum: "$sellingPrice" },
          unitCost: { $sum: "$unitCost" },
          expiryDate: { $last: "$expiryDate" },
          itemId: { $last: "$item_id" },
          itemName: { $first: "$itemDetails.itemName" }, // Use itemDetails from lookup

          batches: {
            $push: {
              batch_number: "$batch_number",
              availableQty: "$availableQty",
              purchaseDate: "$purchaseDate",
              unitCost: "$unitCost",
              sellingPrice: "$sellingPrice",
            },
          },
        },
      },
    ]);

    const serializedStocks = await SerializedStock.aggregate([
      {
        $match: { purchase_id: new mongoose.Types.ObjectId(purchaseId) },
      },
      {
        $lookup: {
          from: "items", // Replace "items" with the actual name of your items collection
          localField: "item_id",
          foreignField: "_id",
          as: "itemDetails",
        },
      },
      {
        $unwind: "$itemDetails",
      },
      {
        $group: {
          _id: "$item_id",
          totalStock: { $sum: 1 },
          purchaseQty: { $sum: 1 },
          soldQty: { $sum: { $cond: [{ $eq: ["$status", "Sold"] }, 1, 0] } },
          adjustmentQty: {
            $sum: { $cond: [{ $eq: ["$status", "Damaged"] }, 1, 0] },
          },
          unitCost: { $first: "$unitCost" },
          itemName: { $first: "$itemDetails.itemName" }, // Use itemDetails from lookup
          sellingPrice: { $first: "$sellingPrice" },
          purchaseDate: { $first: "$purchaseDate" },
          expiryDate: { $first: "$expiryDate" },
          batch_number: { $first: "$batch_number" },
          serialNumber: { $push: "$serialNumber" },
          itemId: { $last: "$item_id" },
          batches: {
            $push: {
              batch_number: "$batch_number",
              serialNumber: "$serialNumber",
              purchaseDate: "$purchaseDate",
              availableQty: {
                $cond: [{ $eq: ["$status", "Available"] }, 1, 0],
              },
              unitCost: "$unitCost",
              sellingPrice: "$sellingPrice",
            },
          },
        },
      },
    ]);

    // Merge non-serialized and serialized stock data
    const mergedStocks = nonSerializedStocks.map((nonSerialized) => ({
      ...nonSerialized,
      profit_margin:
        ((nonSerialized.sellingPrice - nonSerialized.unitCost) /
          nonSerialized.sellingPrice) *
        100,
    }));

    serializedStocks.forEach((serialized) => {
      mergedStocks.push(serialized);
      // mergedStocks.push({
      //   item_id: serialized._id,
      //   batch_number: "N/A", // Serialized items might not have a batch number
      //   purchaseDate: serialized.purchaseDate,
      //   purchase_qty: serialized.totalStock,
      //   availableQty: serialized.totalStock - serialized.soldQty - serialized.adjustmentQty,
      //   soldQty: serialized.soldQty,
      //   adjustmentQty: serialized.adjustmentQty,
      //   unitCost: serialized.unitCost,
      //   sellingPrice: serialized.sellingPrice,
      //   profit_margin: ((serialized.sellingPrice - serialized.unitCost) / serialized.sellingPrice) * 100,
      //   expiry_date: serialized.expiry_date || null,
      //   adjustment_reason: "N/A", // Serialized items might not have an adjustment reason
      // });
    });

    res.status(200).json(mergedStocks);
  } catch (error) {
    console.error("Error fetching stock data by purchase ID:", error);
    res.status(500).json({ message: "Error fetching stock data", error });
  }
};

exports.getUnifiedStock1 = async (req, res) => {
  try {
    // Fetch all items
    const items = await Items.find();

    const nonSerializedStocks = await NonSerializedStock.aggregate([
      {
        $group: {
          _id: "$item_id",
          item_id: { $last: "$item_id" },
          totalStock: { $sum: "$availableQty" }, // Sum of availableQty
          totalSold: { $sum: "$soldQty" }, // Sum of availableQty
          lastSellingPrice: { $last: "$sellingPrice" },
          lastUnitCost: { $last: "$unitCost" }, // Count of available serialized items
          batches: {
            $push: {
              batch_number: "$batch_number",
              availableQty: "$availableQty",
              purchaseDate: "$purchaseDate",
              unitCost: "$unitCost",
              sellingPrice: "$sellingPrice",
              purchase_id: "$purchase_id",
            },
          },
        },
      },
      {
        $unwind: "$batches",
      },
      {
        $lookup: {
          from: "purchases", // Name of the purchases collection
          localField: "batches.purchase_id",
          foreignField: "_id",
          as: "purchase_info",
        },
      },
      {
        $unwind: "$purchase_info",
      },
      {
        $sort: { "batches.purchaseDate": -1 }, // Sort by purchaseDate
      },
      {
        $lookup: {
          from: "suppliers", // Name of the suppliers collection
          localField: "purchase_info.supplier",
          foreignField: "_id",
          as: "supplier_info",
        },
      },
      {
        $unwind: "$supplier_info",
      },
      {
        $group: {
          _id: "$item_id",
          totalStock: { $first: "$totalStock" },
          totalSold: { $first: "$soldQty" }, // Sum of availableQty

          lastSellingPrice: { $first: "$lastSellingPrice" },
          lastUnitCost: { $first: "$lastUnitCost" },
          batches: {
            $push: {
              item_id: "$item_id",
              batch_number: "$batches.batch_number",
              availableQty: "$batches.availableQty",
              purchaseDate: "$batches.purchaseDate",
              unitCost: "$batches.unitCost",
              sellingPrice: "$batches.sellingPrice",
              purchase_id: "$batches.purchase_id",
              purchase: "$purchase_info",
              supplier: "$supplier_info",
            },
          },
        },
      },

      { $sort: { totalStock: -1 } },
    ]);

    console.log("nonSerializedStocks ", nonSerializedStocks);

    // Fetch serialized stock details
    const serializedStocks = await SerializedStock.aggregate([
      {
        $match: { status: "Available" }, // Filter only available serialized items
      },
      {
        $group: {
          _id: "$item_id",
          item_id: { $last: "$item_id" },
          totalStock: { $sum: 1 }, // Count of available serialized items
          lastSellingPrice: { $last: "$sellingPrice" },
          lastUnitCost: { $last: "$unitCost" },
          batches: {
            $push: {
              batch_number: "$batch_number",
              serialNumber: "$serialNumber",
              status: "$status",
              purchaseDate: "$purchaseDate",
              unitCost: "$unitCost",
              sellingPrice: "$sellingPrice",
              purchase_id: "$purchase_id",
            },
          },
        },
      },
      { $unwind: "$batches" },
      {
        $lookup: {
          from: "purchases", // Name of the purchases collection
          localField: "batches.purchase_id",
          foreignField: "_id",
          as: "purchase_info",
        },
      },
      { $unwind: "$purchase_info" },
      {
        $sort: { "batches.purchaseDate": -1 }, // Sort by purchaseDate
      },
      {
        $lookup: {
          from: "suppliers", // Name of the suppliers collection
          localField: "purchase_info.supplier",
          foreignField: "_id",
          as: "supplier_info",
        },
      },
      { $unwind: "$supplier_info" },
      {
        $group: {
          _id: "$item_id",
          totalStock: { $first: "$totalStock" },
          lastSellingPrice: { $first: "$lastSellingPrice" },
          lastUnitCost: { $first: "$lastUnitCost" },
          batches: {
            $push: {
              item_id: "$item_id",
              batch_number: "$batches.batch_number",
              serialNumber: "$batches.serialNumber",
              status: "$batches.status",
              purchaseDate: "$batches.purchaseDate",
              unitCost: "$batches.unitCost",
              sellingPrice: "$batches.sellingPrice",
              purchase_id: "$batches.purchase_id",
              purchase: "$purchase_info",
              supplier: "$supplier_info",
            },
          },
        },
      },

      { $sort: { totalStock: -1 } },
    ]);

    console.log("serializedStocks", serializedStocks);

    // Map and merge stock data into a unified result
    const result = items.map((item) => {
      const nonSerialized = nonSerializedStocks.find(
        (stock) => stock._id.toString() === item._id.toString()
      );
      const serialized = serializedStocks.find(
        (stock) => stock._id.toString() === item._id.toString()
      );

      const lastSellingPrice = item.serialized
        ? serialized?.lastSellingPrice || 0
        : nonSerialized?.lastSellingPrice || 0;

      const lastUnitCost = item.serialized
        ? serialized?.lastUnitCost || 0
        : nonSerialized?.lastUnitCost || 0;

      return {
        ...item.toObject(),

        lastSellingPrice,
        lastUnitCost,

        isSerialized: item.serialized,
        totalStock:
          (nonSerialized?.totalStock || 0) + (serialized?.totalStock || 0),
        batches: nonSerialized?.batches || serialized?.batches,
        serializedItems: serialized?.batches || [],
      };
    });

    console.log("stock details ", result);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching unified stock data" });
  }
};

exports.getUnifiedStock2 = async (req, res) => {
  try {
    // Fetch all items
    const items = await Items.find();

    // Non-serialized stock aggregation
    const nonSerializedStocks = await NonSerializedStock.aggregate([
      {
        $group: {
          _id: "$item_id",
          item_id: { $last: "$item_id" },
          totalStock: { $sum: "$availableQty" },
          totalSold: { $sum: "$soldQty" },
          lastSellingPrice: { $last: "$sellingPrice" },
          lastUnitCost: { $last: "$unitCost" },
          batches: {
            $push: {
              batch_number: "$batch_number",
              availableQty: "$availableQty",
              purchaseDate: "$purchaseDate",
              unitCost: "$unitCost",
              sellingPrice: "$sellingPrice",
              purchase_id: "$purchase_id",
            },
          },
        },
      },
      { $unwind: "$batches" },
      {
        $lookup: {
          from: "purchases",
          localField: "batches.purchase_id",
          foreignField: "_id",
          as: "purchase_info",
        },
      },
      {
        $unwind: {
          path: "$purchase_info",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "suppliers",
          localField: "purchase_info.supplier",
          foreignField: "_id",
          as: "supplier_info",
        },
      },
      {
        $unwind: {
          path: "$supplier_info",
          preserveNullAndEmptyArrays: true, // Keep docs if no supplier found
        },
      },
      {
        $sort: { "batches.purchaseDate": -1 },
      },
      {
        $group: {
          _id: "$item_id",
          totalStock: { $first: "$totalStock" },
          totalSold: { $first: "$totalSold" },
          lastSellingPrice: { $first: "$lastSellingPrice" },
          lastUnitCost: { $first: "$lastUnitCost" },
          batches: {
            $push: {
              item_id: "$item_id",
              batch_number: "$batches.batch_number",
              availableQty: "$batches.availableQty",
              purchaseDate: "$batches.purchaseDate",
              unitCost: "$batches.unitCost",
              sellingPrice: "$batches.sellingPrice",
              purchase_id: "$batches.purchase_id",
              purchase: "$purchase_info",
              supplier: "$supplier_info",
            },
          },
        },
      },
      { $sort: { totalStock: -1 } },
    ]);

    // Serialized stock aggregation
    // Serialized stock aggregation with corrections
    const serializedStocks = await SerializedStock.aggregate([
      { $match: { status: "Available" } },

      // Lookup variant info - Fixed to use correct field mapping
      {
        $lookup: {
          from: "itemvariants",
          localField: "variant_id",
          foreignField: "_id",
          as: "variantInfo",
        },
      },
      { $unwind: { path: "$variantInfo", preserveNullAndEmptyArrays: true } },

      // Lookup item info
      {
        $lookup: {
          from: "items",
          localField: "item_id",
          foreignField: "_id",
          as: "itemInfo",
        },
      },
      { $unwind: { path: "$itemInfo", preserveNullAndEmptyArrays: true } },

      // Group per item + variant to compute stock per variant - FIXED
      {
        $group: {
          _id: {
            item_id: "$item_id",
            variant_id: "$variantInfo._id", // Use variant ID from ItemVariant, not SerializedStock
          },
          item_id: { $first: "$item_id" },
          variant_id: { $first: "$variantInfo._id" }, // Use variant ID from ItemVariant
          displayName: {
            $first: {
              $ifNull: ["$variantInfo.variantName", "$itemInfo.itemName"],
            },
          },
          isVariant: {
            $first: {
              $cond: [{ $ifNull: ["$variantInfo._id", false] }, true, false],
            },
          },
          attributes: { $first: "$variantInfo.variantAttributes" },
          itemDetails: { $first: "$itemInfo" },
          totalStock: { $sum: 1 }, // Correct variant-level count
          stockUnits: {
            $push: {
              _id: "$_id",
              serialNumber: "$serialNumber",
              unitCost: "$unitCost",
              sellingPrice: "$sellingPrice",
              batteryHealth: "$batteryHealth",
              condition: "$condition",
            },
          },
          batches: {
            $push: {
              batch_number: "$batch_number",
              serialNumber: "$serialNumber",
              batteryHealth: "$batteryHealth",
              status: "$status",
              purchaseDate: "$purchaseDate",
              unitCost: "$unitCost",
              sellingPrice: "$sellingPrice",
              purchase_id: "$purchase_id",
            },
          },
          lastSellingPrice: { $last: "$sellingPrice" },
          lastUnitCost: { $last: "$unitCost" },
        },
      },

      // Process batches with lookups
      { $unwind: "$batches" },
      {
        $lookup: {
          from: "purchases",
          localField: "batches.purchase_id",
          foreignField: "_id",
          as: "purchase_info",
        },
      },
      { $unwind: { path: "$purchase_info", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "suppliers",
          localField: "purchase_info.supplier",
          foreignField: "_id",
          as: "supplier_info",
        },
      },
      { $unwind: { path: "$supplier_info", preserveNullAndEmptyArrays: true } },

      // Regroup to maintain variant-level stock
      {
        $group: {
          _id: {
            item_id: "$item_id",
            variant_id: "$variant_id",
          },
          item_id: { $first: "$item_id" },
          variant_id: { $first: "$variant_id" },
          displayName: { $first: "$displayName" },
          isVariant: { $first: "$isVariant" },
          attributes: { $first: "$attributes" },
          itemDetails: { $first: "$itemDetails" },
          totalStock: { $first: "$totalStock" }, // Preserve variant stock
          lastSellingPrice: { $first: "$lastSellingPrice" },
          lastUnitCost: { $first: "$lastUnitCost" },
          stockUnits: { $first: "$stockUnits" },
          batches: {
            $push: {
              batch_number: "$batches.batch_number",
              serialNumber: "$batches.serialNumber",
              status: "$batches.status",
              purchaseDate: "$batches.purchaseDate",
              unitCost: "$batches.unitCost",
              sellingPrice: "$batches.sellingPrice",
              purchase_id: "$batches.purchase_id",
              purchase: "$purchase_info",
              supplier: "$supplier_info",
            },
          },
        },
      },

      // Final projection
      {
        $project: {
          _id: "$item_id",
          variant_id: 1,
          displayName: 1,
          isVariant: 1,
          attributes: 1,
          itemDetails: 1,
          totalStock: 1,
          lastSellingPrice: 1,
          lastUnitCost: 1,
          stockUnits: 1,
          batches: 1,
        },
      },
      { $sort: { totalStock: -1 } },
    ]);

    console.log(
      "serializedStocks",
      serializedStocks.filter((x) => x.itemDetails.category === "Device")
    );

    // Map and merge stock data with robust fallbacks
    // Modified merging logic to handle variants
    const result = items.flatMap((item) => {
      const nonSerialized = nonSerializedStocks.find(
        (stock) => stock._id.toString() === item._id.toString()
      );

      const serializedVariants = serializedStocks.filter(
        (stock) => stock._id.toString() === item._id.toString()
      );

      // Return base item with non-serialized stock
      const baseItem = {
        ...item.toObject(),
        itemName: item.itemName,
        lastSellingPrice: nonSerialized?.lastSellingPrice || 0,
        lastUnitCost: nonSerialized?.lastUnitCost || 0,
        isSerialized: item.serialized,
        totalStock: nonSerialized?.totalStock || 0,
        batches: nonSerialized?.batches || [],
        serializedItems: [],
      };

      // Create entries for each variant
      const variants = serializedVariants.map((variant) => ({
        ...baseItem,
        variant_id: variant.variant_id,
        displayName: variant.displayName,
        isVariant: true,
        attributes: variant.attributes,
        totalStock: variant.totalStock,
        lastSellingPrice: variant.lastSellingPrice,
        lastUnitCost: variant.lastUnitCost,
        batches: variant.batches,
        serializedItems: variant.stockUnits,
      }));

      return variants.length > 0 ? variants : [baseItem];
    });

    res.json(result);
  } catch (error) {
    console.error("Error in getUnifiedStock:", error);
    res.status(500).json({
      message: "Error fetching unified stock data",
      error: error.message,
    });
  }
};
exports.getUnifiedStock3 = async (req, res) => {
  try {
    // Fetch all items
    const items = await Items.find();

    // Non-serialized stock aggregation (same as before)
    const nonSerializedStocks = await NonSerializedStock.aggregate([
      {
        $group: {
          _id: "$item_id",
          item_id: { $last: "$item_id" },
          totalStock: { $sum: "$availableQty" },
          totalSold: { $sum: "$soldQty" },
          lastSellingPrice: { $last: "$sellingPrice" },
          lastUnitCost: { $last: "$unitCost" },
          batches: {
            $push: {
              batch_number: "$batch_number",
              availableQty: "$availableQty",
              purchaseDate: "$purchaseDate",
              unitCost: "$unitCost",
              sellingPrice: "$sellingPrice",
              purchase_id: "$purchase_id",
            },
          },
        },
      },
      { $unwind: "$batches" },
      {
        $lookup: {
          from: "purchases",
          localField: "batches.purchase_id",
          foreignField: "_id",
          as: "purchase_info",
        },
      },
      { $unwind: { path: "$purchase_info", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "suppliers",
          localField: "purchase_info.supplier",
          foreignField: "_id",
          as: "supplier_info",
        },
      },
      { $unwind: { path: "$supplier_info", preserveNullAndEmptyArrays: true } },
      { $sort: { "batches.purchaseDate": -1 } },
      {
        $group: {
          _id: "$item_id",
          totalStock: { $first: "$totalStock" },
          totalSold: { $first: "$totalSold" },
          lastSellingPrice: { $first: "$lastSellingPrice" },
          lastUnitCost: { $first: "$lastUnitCost" },
          batches: {
            $push: {
              item_id: "$item_id",
              batch_number: "$batches.batch_number",
              availableQty: "$batches.availableQty",
              purchaseDate: "$batches.purchaseDate",
              unitCost: "$batches.unitCost",
              sellingPrice: "$batches.sellingPrice",
              purchase_id: "$batches.purchase_id",
              purchase: "$purchase_info",
              supplier: "$supplier_info",
            },
          },
        },
      },
      { $sort: { totalStock: -1 } },
    ]);

    // Serialized stock aggregation (variant aware)
    const serializedStocks = await SerializedStock.aggregate([
      { $match: { status: "Available" } },
      {
        $lookup: {
          from: "itemvariants",
          localField: "variant_id",
          foreignField: "_id",
          as: "variantInfo",
        },
      },
      { $unwind: { path: "$variantInfo", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "items",
          localField: "item_id",
          foreignField: "_id",
          as: "itemInfo",
        },
      },
      { $unwind: { path: "$itemInfo", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            item_id: "$item_id",
            variant_id: "$variantInfo._id",
          },
          item_id: { $first: "$item_id" },
          variant_id: { $first: "$variantInfo._id" },
          displayName: {
            $first: {
              $ifNull: ["$variantInfo.variantName", "$itemInfo.itemName"],
            },
          },
          isVariant: {
            $first: {
              $cond: [{ $ifNull: ["$variantInfo._id", false] }, true, false],
            },
          },
          attributes: { $first: "$variantInfo.variantAttributes" },
          itemDetails: { $first: "$itemInfo" },
          totalStock: { $sum: 1 },
          stockUnits: {
            $push: {
              _id: "$_id",
              serialNumber: "$serialNumber",
              unitCost: "$unitCost",
              sellingPrice: "$sellingPrice",
              batteryHealth: "$batteryHealth",
              condition: "$condition",
            },
          },
          batches: {
            $push: {
              batch_number: "$batch_number",
              serialNumber: "$serialNumber",
              status: "$status",
              purchaseDate: "$purchaseDate",
              unitCost: "$unitCost",
              sellingPrice: "$sellingPrice",
              purchase_id: "$purchase_id",
            },
          },
          lastSellingPrice: { $last: "$sellingPrice" },
          lastUnitCost: { $last: "$unitCost" },
        },
      },
      { $sort: { "batches.purchaseDate": -1 } },
    ]);

    // Merge items with both non-serialized & serialized stock
    const result = items.flatMap((item) => {
      const nonSerialized = nonSerializedStocks.find(
        (stock) => stock._id.toString() === item._id.toString()
      );

      const serializedVariants = serializedStocks.filter(
        (stock) => stock.item_id.toString() === item._id.toString()
      );

      if (serializedVariants.length > 0) {
        // ✅ Replace base item with variant rows
        return serializedVariants.map((variant) => ({
          _id: item._id, // all variants share same item_id
          variant_id: variant.variant_id,
          itemName: variant.displayName, // use variant name
          attributes: variant.attributes,
          category: item.category,
          isVariant: true,
          totalStock: variant.totalStock,
          lastSellingPrice: variant.lastSellingPrice,
          lastUnitCost: variant.lastUnitCost,
          batches: variant.batches,
          serializedItems: variant.stockUnits,
          itemDetails: variant.itemDetails,
        }));
      } else {
        // Fallback to base item
        return {
          ...item.toObject(),
          itemName: item.itemName,
          isVariant: false,
          totalStock: nonSerialized?.totalStock || 0,
          lastSellingPrice: nonSerialized?.lastSellingPrice || 0,
          lastUnitCost: nonSerialized?.lastUnitCost || 0,
          batches: nonSerialized?.batches || [],
          serializedItems: [],
        };
      }
    });

    res.json(result);
  } catch (error) {
    console.error("Error in getUnifiedStock:", error);
    res.status(500).json({
      message: "Error fetching unified stock data",
      error: error.message,
    });
  }
};

// Controller: getUnifiedStock (variant-first, field-complete, correct totals)
exports.getUnifiedStock111111 = async (req, res) => {
  try {
    const { search, page, limit, category, includeEmptyBase } = req.query;

    // 1) Load items with optional search and pagination
    let query = {};

    // Apply category filter if provided and not "All"
    if (category && category !== "All") {
      query.category = category;
    }

    if (search) {
      const tokens = search.split(/\s+/).filter((t) => t.length > 0);
      if (tokens.length > 0) {
        // Find item IDs matching any token as a serial number (sub-search)
        const potentialSerialTokens = tokens.filter((t) => t.length >= 5);
        let serialItemIds = [];
        if (potentialSerialTokens.length > 0) {
          const matchingSerials = await SerializedStock.find(
            {
              serialNumber: {
                $in: potentialSerialTokens.map((t) => new RegExp(t, "i")),
              },
            },
            "item_id"
          ).lean();
          serialItemIds = matchingSerials.map((s) => s.item_id);
        }

        const regexes = tokens.map((t) => new RegExp(t, "i"));
        query.$or = [
          {
            $and: regexes.map((re) => ({
              $or: [{ itemName: re }, { barcode: re }],
            })),
          },
          { _id: { $in: serialItemIds } },
        ];
      }
    }

    let itemsQuery = Items.find(query).lean();

    // Support pagination if requested
    if (page && limit) {
      const skip = (parseInt(page) - 1) * parseInt(limit);
      itemsQuery = itemsQuery.skip(skip).limit(parseInt(limit));
    } else if (!search) {
      // If no search and no pagination, maybe limit to a reasonable amount to prevent crash
      // But user said "careful if old api already cna access this", 
      // so if no params are passed, we shouldn't break existing "load all" behavior unless it's strictly necessary.
      // itemsQuery = itemsQuery.limit(500); 
    }

    const items = await itemsQuery;
    const itemIds = items.map((i) => i._id);

    // 2) Load all variants for these items and bucket by item_id
    const allVariants = await ItemVariant.find({
      item_id: { $in: itemIds },
    }).lean();
    const variantsByItem = allVariants.reduce((acc, v) => {
      const key = String(v.item_id);
      if (!acc[key]) acc[key] = [];
      acc[key].push(v);
      return acc;
    }, {});

    // 3) Non-serialized stock aggregation (with purchase & supplier joins)
    const nonSerializedStocks = await NonSerializedStock.aggregate([
      {
        $group: {
          _id: {
            item_id: "$item_id",
            variant_id: { $ifNull: ["$variant_id", null] },
          },
          item_id: { $first: "$item_id" },
          variant_id: { $first: "$variant_id" },

          totalStock: { $sum: "$availableQty" },
          totalSold: { $sum: "$soldQty" },
          lastSellingPrice: { $last: "$sellingPrice" },
          lastUnitCost: { $last: "$unitCost" },

          batches: {
            $push: {
              batch_number: "$batch_number",
              availableQty: "$availableQty",
              purchaseDate: "$purchaseDate",
              unitCost: "$unitCost",
              sellingPrice: "$sellingPrice",
              purchase_id: "$purchase_id",
            },
          },
        },
      },

      { $unwind: "$batches" },

      {
        $lookup: {
          from: "purchases",
          localField: "batches.purchase_id",
          foreignField: "_id",
          as: "purchase_info",
        },
      },
      { $unwind: { path: "$purchase_info", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "suppliers",
          localField: "purchase_info.supplier",
          foreignField: "_id",
          as: "supplier_info",
        },
      },
      { $unwind: { path: "$supplier_info", preserveNullAndEmptyArrays: true } },

      { $sort: { "batches.purchaseDate": -1 } },

      {
        $group: {
          _id: "$_id", // keep composite key
          item_id: { $first: "$item_id" },
          variant_id: { $first: "$variant_id" },
          totalStock: { $first: "$totalStock" },
          totalSold: { $first: "$totalSold" },
          lastSellingPrice: { $first: "$lastSellingPrice" },
          lastUnitCost: { $first: "$lastUnitCost" },

          batches: {
            $push: {
              item_id: "$item_id",
              variant_id: "$variant_id",
              batch_number: "$batches.batch_number",
              availableQty: "$batches.availableQty",
              purchaseDate: "$batches.purchaseDate",
              unitCost: "$batches.unitCost",
              sellingPrice: "$batches.sellingPrice",
              purchase_id: "$batches.purchase_id",
              purchase: "$purchase_info",
              supplier: "$supplier_info",
            },
          },
        },
      },
    ]);


    const nonSerMap = new Map(
      nonSerializedStocks.map((ns) => [String(ns._id), ns])
    );

    // 4) Serialized stock aggregation grouped by (item_id, variant_id)
    // Sort before group so $last returns true "latest" price by purchaseDate
    const serializedAgg = await SerializedStock.aggregate([
      { $match: { status: "Available", item_id: { $in: itemIds } } },
      { $sort: { purchaseDate: 1, createdAt: 1 } },

      {
        $lookup: {
          from: "itemvariants",
          localField: "variant_id",
          foreignField: "_id",
          as: "variantInfo",
        },
      },
      { $unwind: { path: "$variantInfo", preserveNullAndEmptyArrays: true } },

      // Keep raw docs for $last semantics, lookups can be after grouping or before;
      // We group first to get last prices reliably, then enrich batches.
      {
        $group: {
          _id: { item_id: "$item_id", variant_id: "$variantInfo._id" },
          item_id: { $first: "$item_id" },
          variant_id: { $first: "$variantInfo._id" }, // can be null when no variant used
          totalAvailable: { $sum: 1 },
          lastSellingPrice: { $last: "$sellingPrice" },
          batteryHealth: { $last: "$batteryHealth" },
          condition: { $last: "$condition" },

          lastUnitCost: { $last: "$unitCost" },
          stockUnits: {
            $push: {
              _id: "$_id",
              serialNumber: "$serialNumber",
              unitCost: "$unitCost",
              sellingPrice: "$sellingPrice",
              batteryHealth: "$batteryHealth",
              condition: "$condition",
              batch_number: "$batch_number",
              purchaseDate: "$purchaseDate",
              purchase_id: "$purchase_id",
            },
          },
          batches: {
            $push: {
              batch_number: "$batch_number",
              serialNumber: "$serialNumber",
              batteryHealth: "$batteryHealth",
              condition: "$condition",
              status: "$status",
              purchaseDate: "$purchaseDate",
              unitCost: "$unitCost",
              sellingPrice: "$sellingPrice",
              purchase_id: "$purchase_id",
            },
          },
        },
      },

      // Enrich batches with purchase & supplier
      { $unwind: "$batches" },
      {
        $lookup: {
          from: "purchases",
          localField: "batches.purchase_id",
          foreignField: "_id",
          as: "purchase_info",
        },
      },
      { $unwind: { path: "$purchase_info", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "suppliers",
          localField: "purchase_info.supplier",
          foreignField: "_id",
          as: "supplier_info",
        },
      },
      { $unwind: { path: "$supplier_info", preserveNullAndEmptyArrays: true } },

      // Reassemble per (item_id, variant_id)
      {
        $group: {
          _id: { item_id: "$item_id", variant_id: "$variant_id" },
          item_id: { $first: "$item_id" },
          variant_id: { $first: "$variant_id" },
          totalAvailable: { $first: "$totalAvailable" },
          lastSellingPrice: { $first: "$lastSellingPrice" },
          lastUnitCost: { $first: "$lastUnitCost" },
          stockUnits: { $first: "$stockUnits" },
          batteryHealth: { $first: "$batteryHealth" },
          // condition: "$batches.condition",
          batches: {
            $push: {
              item_id: "$item_id",
              batch_number: "$batches.batch_number",
              serialNumber: "$batches.serialNumber",
              batteryHealth: "$batches.batteryHealth",
              condition: "$batches.condition",
              status: "$batches.status",
              purchaseDate: "$batches.purchaseDate",
              unitCost: "$batches.unitCost",
              sellingPrice: "$batches.sellingPrice",
              purchase_id: "$batches.purchase_id",
              purchase: "$purchase_info",
              supplier: "$supplier_info",
              invoiceNumber: { $ifNull: ["$purchase_info.referenceNumber", ""] },
            },
          },
        },
      },
    ]);

    // Build a map keyed by `${itemId}__${variantId || 'null'}`
    const serMap = new Map(
      serializedAgg.map((s) => [
        `${String(s.item_id)}__${s.variant_id ? String(s.variant_id) : "null"}`,
        s,
      ])
    );

    // 5) Build final rows
    const result = [];
    for (const item of items) {
      const itemKey = String(item._id);
      const variants = variantsByItem[itemKey] || [];

      const hasVariantStock = variants.some((v) => {
        const k = `${itemKey}__${String(v._id)}`;
        const ag = serMap.get(k);
        return ag && ag.totalAvailable > 0;
      });

      if (variants.length > 0) {
        // Replace base item with one row per variant (even if stock = 0)
        for (const v of variants) {
          const k = `${itemKey}__${String(v._id)}`;
          const ag = serMap.get(k);

          // Compose variant row, preserving ALL base item fields
          result.push({
            ...item, // keep every item field
            _id: item._id, // required: all variants share item_id
            uId: `${itemKey}_${v._id}`, // Unique ID for UI expansion
            isVariant: true,
            isSerialized: item.serialized,

            variant_id: v._id,
            itemName: v.variantName, // replace name with variant name
            variantName: v.variantName,
            variantAttributes: v.variantAttributes || [],
            sku: v.sku || null,
            barcode: v.barcode || item.barcode || null, // Priority to variant barcode
            defaultSellingPrice: v.defaultSellingPrice || 0,
            variantLastUnitCost: v.lastUnitCost || 0,
            batteryHealth: ag?.batteryHealth || null,
            condition: ag?.condition || null,
            // Computed from serialized aggregation (per-variant only)
            totalStock: ag?.totalAvailable || 0,
            lastSellingPrice:
              ag?.lastSellingPrice ?? v.defaultSellingPrice ?? 0,
            lastUnitCost: ag?.lastUnitCost ?? v.lastUnitCost ?? 0,

            // Enriched arrays - SORTED Newest First
            serializedItems: (ag?.batches || []).sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate)),
            batches: (ag?.batches || []).sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate)),

            // Optional: keep non-serialized reference if you need it on variant rows
            // (Usually 0 because non-serialized isn't variant-tracked)
            nonSerialized: nonSerMap.get(itemKey) || null,
          });
        }

        // Additionally, include a "base item" row ONLY if it has non-serialized stock OR 
        // if there is serialized stock that isn't tied to any specific variant (serNoVar).
        // This prevents showing a redundant "Base" row for items that are fully variant-tracked.
        const serNoVar = serMap.get(`${itemKey}__null`);
        const ns = nonSerMap.get(itemKey);

        const shouldShowBase =
          // Only if NO variant has stock
          !hasVariantStock &&
          (
            (ns && ns.totalStock > 0) ||
            (serNoVar && serNoVar.totalAvailable > 0) ||
            includeEmptyBase === "true"
          );

        if (shouldShowBase
        ) {
          result.push({
            ...item,
            _id: item._id,
            uId: `${itemKey}_base`,
            isSerialized: item.serialized,
            isVariant: false,
            isBase: true,
            variant_id: null,
            itemName: item.itemName,
            variantName: null,
            variantAttributes: [],
            totalStock:
              (ns?.totalStock || 0) +
              (serNoVar?.totalAvailable || 0),
            lastSellingPrice:
              serNoVar?.lastSellingPrice ||
              ns?.lastSellingPrice ||
              item.pricing?.sellingPrice ||
              0,
            lastUnitCost:
              serNoVar?.lastUnitCost ||
              ns?.lastUnitCost ||
              0,
            batches: [
              ...(ns?.batches || []),
              ...(serNoVar?.batches || []),
            ].sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate)),
            serializedItems: (serNoVar?.batches || []).sort(
              (a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate)
            ),
          });
        }
      } else {
        // No variants: return a single base item row merging both flows
        const ns = nonSerMap.get(itemKey);
        const serNoVar = serMap.get(`${itemKey}__null`);

        result.push({
          ...item,
          _id: item._id,
          uId: `${itemKey}_base`,
          isSerialized: item.serialized,
          isVariant: false,
          variant_id: null,
          itemName: item.itemName,
          variantName: null,
          variantAttributes: [],
          sku: null,
          barcode: item.barcode,
          defaultSellingPrice: item.defaultSellingPrice || 0,
          variantLastUnitCost: 0,

          // Combine totals for items with no variants
          totalStock: (ns?.totalStock || 0) + (serNoVar?.totalAvailable || 0),
          lastSellingPrice:
            serNoVar?.lastSellingPrice ?? ns?.lastSellingPrice ?? 0,
          lastUnitCost: serNoVar?.lastUnitCost ?? ns?.lastUnitCost ?? 0,
          serializedItems: (serNoVar?.batches || []).sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate)),

          // Merge batch views (heterogeneous entries: serialized vs non-serialized)
          batches: [...(ns?.batches || []), ...(serNoVar?.batches || [])].sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate)),

          nonSerialized: ns || null,
        });
      }
    }

    console.log(result.filter((x) => x.category === "Device"));
    res.json(result);
  } catch (error) {
    console.error("Error in getUnifiedStock:", error);
    res.status(500).json({
      message: "Error fetching unified stock data",
      error: error.message,
    });
  }
};

exports.getUnifiedStock_legacy = async (req, res) => {
  try {
    const { search, page, limit, category, includeEmptyBase } = req.query;

    /* -------------------------------------------------
       1) LOAD ITEMS
    -------------------------------------------------- */
    let query = {};
    if (category && category !== "All") query.category = category;

    if (search) {
      const tokens = search.split(/\s+/).filter(Boolean);
      if (tokens.length) {
        const regexes = tokens.map(t => new RegExp(t, "i"));
        query.$or = [
          { itemName: { $in: regexes } },
          { barcode: { $in: regexes } },
        ];
      }
    }

    let itemsQuery = Items.find(query).lean();
    if (page && limit) {
      itemsQuery = itemsQuery
        .skip((+page - 1) * +limit)
        .limit(+limit);
    }

    const items = await itemsQuery;
    const itemIds = items.map(i => i._id);

    /* -------------------------------------------------
       2) LOAD VARIANTS
    -------------------------------------------------- */
    const variants = await ItemVariant.find({
      item_id: { $in: itemIds },
    }).lean();

    const variantsByItem = variants.reduce((acc, v) => {
      const k = String(v.item_id);
      acc[k] ??= [];
      acc[k].push(v);
      return acc;
    }, {});

    /* -------------------------------------------------
       3) NON-SERIALIZED STOCK (VARIANT-AWARE)
    -------------------------------------------------- */
    const nonSerializedStocks = await NonSerializedStock.aggregate([
      {
        $group: {
          _id: {
            item_id: "$item_id",
            variant_id: { $ifNull: ["$variant_id", null] },
          },
          item_id: { $first: "$item_id" },
          variant_id: { $first: "$variant_id" },
          totalStock: { $sum: "$availableQty" },
          lastSellingPrice: { $last: "$sellingPrice" },
          lastUnitCost: { $last: "$unitCost" },
        },
      },
    ]);

    const nonSerMap = new Map(
      nonSerializedStocks.map(ns => [
        `${String(ns.item_id)}__${ns.variant_id ? String(ns.variant_id) : "null"}`,
        ns,
      ])
    );

    /* -------------------------------------------------
       4) SERIALIZED STOCK (VARIANT-AWARE)
    -------------------------------------------------- */
    const serializedAgg = await SerializedStock.aggregate([
      { $match: { status: "Available", item_id: { $in: itemIds } } },
      {
        $group: {
          _id: {
            item_id: "$item_id",
            variant_id: { $ifNull: ["$variant_id", null] },
          },
          item_id: { $first: "$item_id" },
          variant_id: { $first: "$variant_id" },
          totalAvailable: { $sum: 1 },
          lastSellingPrice: { $last: "$sellingPrice" },
          lastUnitCost: { $last: "$unitCost" },
        },
      },
    ]);

    const serMap = new Map(
      serializedAgg.map(s => [
        `${String(s.item_id)}__${s.variant_id ? String(s.variant_id) : "null"}`,
        s,
      ])
    );

    /* -------------------------------------------------
       5) BUILD FINAL RESULT (STRICT RULES)
    -------------------------------------------------- */
    const result = [];

    for (const item of items) {
      const itemKey = String(item._id);
      const itemVariants = variantsByItem[itemKey] || [];

      /* ---------- VARIANT ROWS ---------- */
      if (itemVariants.length) {
        for (const v of itemVariants) {
          const k = `${itemKey}__${v._id}`;
          const ser = serMap.get(k);
          const ns = nonSerMap.get(k);

          result.push({
            ...item,
            uId: `${itemKey}_${v._id}`,
            isVariant: true,
            isBase: false,
            variant_id: v._id,
            itemName: v.variantName,
            itemImage: v.variantImage || item.itemImage, // Variant-specific image
            variantAttributes: v.variantAttributes, // Include attributes for UI
            sku: v.sku,
            barcode: v.barcode || item.barcode,
            totalStock:
              (ser?.totalAvailable || 0) +
              (ns?.totalStock || 0),
            lastSellingPrice:
              ser?.lastSellingPrice ??
              ns?.lastSellingPrice ??
              v.defaultSellingPrice ??
              0,
            lastUnitCost:
              ser?.lastUnitCost ??
              ns?.lastUnitCost ??
              0,
          });
        }

        /* ---------- BASE ROW (HARD BLOCK) ---------- */
        const hasAnyVariantStock = itemVariants.some(v => {
          const k = `${itemKey}__${v._id}`;
          return (
            (serMap.get(k)?.totalAvailable || 0) > 0 ||
            (nonSerMap.get(k)?.totalStock || 0) > 0
          );
        });

        const baseKey = `${itemKey}__null`;
        const baseSer = serMap.get(baseKey);
        const baseNs = nonSerMap.get(baseKey);

        if (
          !hasAnyVariantStock &&
          (
            (baseSer?.totalAvailable || 0) > 0 ||
            (baseNs?.totalStock || 0) > 0 ||
            includeEmptyBase === "true"
          )
        ) {
          result.push({
            ...item,
            uId: `${itemKey}_base`,
            isVariant: false,
            isBase: true,
            variant_id: null,
            itemName: item.itemName,
            itemImage: item.itemImage,
            serializedItems: ser?.stockUnits || [],
            batches: [...(ns?.batches || []), ...(ser?.batches || [])],
            totalStock:
              (baseSer?.totalAvailable || 0) +
              (baseNs?.totalStock || 0),
            lastSellingPrice:
              baseSer?.lastSellingPrice ??
              baseNs?.lastSellingPrice ??
              0,
            lastUnitCost:
              baseSer?.lastUnitCost ??
              baseNs?.lastUnitCost ??
              0,
          });
        }
      }

      /* ---------- NO VARIANTS ---------- */
      else {
        const k = `${itemKey}__null`;
        const ser = serMap.get(k);
        const ns = nonSerMap.get(k);

        result.push({
          ...item,
          uId: `${itemKey}_base`,
          isVariant: false,
          isBase: true,
          variant_id: null,
          itemName: item.itemName,
          itemImage: item.itemImage,
          serializedItems: ser?.stockUnits || [],
          batches: [...(ns?.batches || []), ...(ser?.batches || [])],
          totalStock:
            (ser?.totalAvailable || 0) +
            (ns?.totalStock || 0),
          lastSellingPrice:
            ser?.lastSellingPrice ??
            ns?.lastSellingPrice ??
            0,
          lastUnitCost:
            ser?.lastUnitCost ??
            ns?.lastUnitCost ??
            0,
        });
      }
    }

    res.json(result);
  } catch (err) {
    console.error("getUnifiedStock error:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.getUnifiedStock = async (req, res) => {
  try {
    const { search, page, limit, category } = req.query;

    /* -------------------------------------------------
       1) LOAD ITEMS (VARIANT-AWARE SEARCH)
    -------------------------------------------------- */
    let query = {};
    if (category && category !== "All") query.category = category;

    if (search) {
      const tokens = search.split(/\s+/).filter(Boolean);
      if (tokens.length) {
        const regexes = tokens.map((t) => new RegExp(t, "i"));

        // Find matching Base Items
        const baseMatches = await Items.find({
          $or: [
            { itemName: { $in: regexes } },
            { barcode: { $in: regexes } },
          ]
        }).select('_id').lean();

        // Find matching Variants
        const variantMatches = await ItemVariant.find({
          $or: [
            { variantName: { $in: regexes } },
            { barcode: { $in: regexes } },
            { sku: { $in: regexes } }
          ]
        }).select('item_id').lean();

        const ids = [
          ...baseMatches.map(i => i._id),
          ...variantMatches.map(v => v.item_id)
        ];

        query._id = { $in: ids };
      }
    }

    let itemsQuery = Items.find(query).lean();
    if (page && limit) {
      itemsQuery = itemsQuery.skip((+page - 1) * +limit).limit(+limit);
    }

    const items = await itemsQuery;
    const itemIds = items.map((i) => i._id);

    /* -------------------------------------------------
       2) LOAD VARIANTS
    -------------------------------------------------- */
    const variants = await ItemVariant.find({
      item_id: { $in: itemIds },
    }).lean();

    const variantsByItem = variants.reduce((acc, v) => {
      const k = String(v.item_id);
      acc[k] ??= [];
      acc[k].push(v);
      return acc;
    }, {});

    /* -------------------------------------------------
       3) SERIALIZED STOCK AGGREGATION
    -------------------------------------------------- */
    const serializedAgg = await SerializedStock.aggregate([
      { $match: { status: "Available", item_id: { $in: itemIds } } },
      {
        $lookup: {
          from: "purchases",
          localField: "purchase_id",
          foreignField: "_id",
          as: "purchase"
        }
      },
      { $unwind: { path: "$purchase", preserveNullAndEmptyArrays: true } },
      { $sort: { purchaseDate: 1 } },
      {
        $group: {
          _id: {
            item_id: "$item_id",
            variant_id: { $ifNull: ["$variant_id", null] },
          },
          totalAvailable: { $sum: 1 },
          lastSellingPrice: { $last: "$sellingPrice" },
          lastUnitCost: { $last: "$unitCost" },
          stockUnits: {
            $push: {
              _id: "$_id",
              serialNumber: "$serialNumber",
              batch_number: "$batch_number",
              condition: "$condition",
              batteryHealth: "$batteryHealth",
              unitCost: "$unitCost",
              sellingPrice: "$sellingPrice",
              purchaseDate: "$purchaseDate",
              purchase: "$purchase",
              purchase_id: "$purchase_id"
            },
          },
        },
      },
    ]);

    const serMap = new Map(
      serializedAgg.map((s) => [
        `${String(s._id.item_id)}__${s._id.variant_id ? String(s._id.variant_id) : "null"}`,
        s,
      ])
    );

    /* -------------------------------------------------
       4) NON-SERIALIZED STOCK AGGREGATION
    -------------------------------------------------- */
    const nonSerializedStocks = await NonSerializedStock.aggregate([
      { $match: { availableQty: { $gt: 0 }, item_id: { $in: itemIds } } },
      {
        $lookup: {
          from: "purchases",
          localField: "purchase_id",
          foreignField: "_id",
          as: "purchase"
        }
      },
      { $unwind: { path: "$purchase", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            item_id: "$item_id",
            variant_id: { $ifNull: ["$variant_id", null] },
          },
          totalStock: { $sum: "$availableQty" },
          lastSellingPrice: { $last: "$sellingPrice" },
          lastUnitCost: { $last: "$unitCost" },
          batches: {
            $push: {
              batch_number: "$batch_number",
              availableQty: "$availableQty",
              unitCost: "$unitCost",
              sellingPrice: "$sellingPrice",
              purchaseDate: "$purchaseDate",
              purchase: "$purchase",
              purchase_id: "$purchase_id"
            },
          },
        },
      },
    ]);

    const nonSerMap = new Map(
      nonSerializedStocks.map((ns) => [
        `${String(ns._id.item_id)}__${ns._id.variant_id ? String(ns._id.variant_id) : "null"}`,
        ns,
      ])
    );

    /* -------------------------------------------------
       5) BUILD FINAL RESULT (EXPERT LOGIC)
    -------------------------------------------------- */
    const result = [];

    const deriveBatchesFromSerials = (units = []) => {
      const batchMap = {};
      units.forEach(u => {
        const bNum = u.batch_number || "NO_BATCH";
        if (!batchMap[bNum]) {
          batchMap[bNum] = {
            batch_number: bNum,
            availableQty: 0,
            unitCost: u.unitCost,
            sellingPrice: u.sellingPrice,
            purchaseDate: u.purchaseDate,
            purchase: u.purchase
          };
        }
        batchMap[bNum].availableQty++;
      });
      return Object.values(batchMap);
    };

    for (const item of items) {
      const itemKey = String(item._id);
      const itemVariants = variantsByItem[itemKey] || [];

      // Logic: If variants exist in ItemVariant, we show ONLY those variants.
      // We do not show the base item unless variants are explicitly null/empty in DB.
      if (itemVariants.length > 0) {
        for (const v of itemVariants) {
          const k = `${itemKey}__${v._id}`;
          const ser = serMap.get(k);
          const ns = nonSerMap.get(k);

          const serUnits = ser?.stockUnits || [];
          const nsBatches = ns?.batches || [];
          const serBatches = deriveBatchesFromSerials(serUnits);

          result.push({
            ...item,
            uId: `${itemKey}_${v._id}`,
            isVariant: true,
            isBase: false,
            variant_id: v._id,
            itemName: v.variantName, // Use variant-specific name
            itemImage: v.variantImage || item.itemImage,
            variantAttributes: v.variantAttributes,
            sku: v.sku,
            barcode: v.barcode || item.barcode,

            totalStock: (ser?.totalAvailable || 0) + (ns?.totalStock || 0),
            lastSellingPrice: ser?.lastSellingPrice ?? ns?.lastSellingPrice ?? v.defaultSellingPrice ?? 0,
            lastUnitCost: ser?.lastUnitCost ?? ns?.lastUnitCost ?? v.lastUnitCost ?? 0,

            serializedItems: serUnits,
            batches: [...nsBatches, ...serBatches],
          });
        }
      } else {
        // Only return Base Item if it has no associated variants in the ItemVariant schema
        const k = `${itemKey}__null`;
        const ser = serMap.get(k);
        const ns = nonSerMap.get(k);

        const serUnits = ser?.stockUnits || [];
        const nsBatches = ns?.batches || [];
        const serBatches = deriveBatchesFromSerials(serUnits);

        result.push({
          ...item,
          uId: `${itemKey}_base`,
          isVariant: false,
          isBase: true,
          variant_id: null,
          itemName: item.itemName,

          totalStock: (ser?.totalAvailable || 0) + (ns?.totalStock || 0),
          lastSellingPrice: ser?.lastSellingPrice ?? ns?.lastSellingPrice ?? item.pricing?.sellingPrice ?? 0,
          lastUnitCost: ser?.lastUnitCost ?? ns?.lastUnitCost ?? item.costPrice ?? 0,

          serializedItems: serUnits,
          batches: [...nsBatches, ...serBatches]
        });
      }
    }

    res.json(result);
  } catch (err) {
    console.error("Error in getUnifiedStock:", err);
    res.status(500).json({ message: "Error fetching unified stock data", error: err.message });
  }
};
// Controller: getItemStockDetails
exports.getItemStockOverview = async (req, res) => {
  try {
    const { itemId } = req.params;
    const imeiPage = parseInt(req.query.imeiPage) || 1;
    const imeiLimit = parseInt(req.query.imeiLimit) || 50;
    const ledgerPage = parseInt(req.query.ledgerPage) || 1;
    const ledgerLimit = parseInt(req.query.ledgerLimit) || 50;

    const skipImei = (imeiPage - 1) * imeiLimit;
    const skipLedger = (ledgerPage - 1) * ledgerLimit;

    // ---------------------------------------------------
    // 1. FETCH ITEM METADATA
    // ---------------------------------------------------
    const item = await Items.findById(itemId).lean();
    if (!item) return res.status(404).json({ message: "Item not found" });

    // ---------------------------------------------------
    // 2. FETCH VARIANTS
    // ---------------------------------------------------
    const variants = await ItemVariant.find({ item_id: itemId }).lean();

    // ---------------------------------------------------
    // 3. FETCH NON-SERIALIZED BATCHES
    // ---------------------------------------------------
    const nonSerialized = await NonSerializedStock.aggregate([
      { $match: { item_id: new mongoose.Types.ObjectId(itemId) } },
      {
        $lookup: {
          from: "purchases",
          localField: "purchase_id",
          foreignField: "_id",
          as: "purchase",
        },
      },
      { $unwind: { path: "$purchase", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "suppliers",
          localField: "purchase.supplier",
          foreignField: "_id",
          as: "supplier",
        },
      },
      { $unwind: { path: "$supplier", preserveNullAndEmptyArrays: true } },
    ]);

    // ---------------------------------------------------
    // 4. PAGINATED SERIALIZED ITEMS (IMEIs)
    // ---------------------------------------------------
    const imeiTotal = await SerializedStock.countDocuments({ item_id: itemId });

    const serialized = await SerializedStock.aggregate([
      { $match: { item_id: new mongoose.Types.ObjectId(itemId) } },
      { $sort: { createdAt: -1 } },
      { $skip: skipImei },
      { $limit: imeiLimit },
      {
        $lookup: {
          from: "purchases",
          localField: "purchase_id",
          foreignField: "_id",
          as: "purchase",
        },
      },
      { $unwind: { path: "$purchase", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "suppliers",
          localField: "purchase.supplier",
          foreignField: "_id",
          as: "supplier",
        },
      },
      { $unwind: { path: "$supplier", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "salesinvoices",
          let: { serial: "$serialNumber", status: "$status" },
          pipeline: [
            { $match: { $expr: { $eq: ["$$status", "Sold"] } } },
            { $unwind: "$items" },
            { $match: { $expr: { $in: ["$$serial", { $ifNull: ["$items.serialNumbers", []] }] } } },
            { $project: { invoice_id: 1, invoice_date: 1, customer: 1, soldPrice: "$items.price" } },
            { $sort: { invoice_date: -1 } },
            { $limit: 1 }
          ],
          as: "saleInfo"
        }
      },
      { $unwind: { path: "$saleInfo", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "customers",
          localField: "saleInfo.customer",
          foreignField: "_id",
          as: "customerInfo"
        }
      },
      { $unwind: { path: "$customerInfo", preserveNullAndEmptyArrays: true } },
    ]);

    // ---------------------------------------------------
    // 5. PAGINATED STOCK LEDGER
    // ---------------------------------------------------
    const ledgerTotal = await StockLedger.countDocuments({ item_id: itemId });

    const ledger = await StockLedger.find({ item_id: itemId })
      .sort({ createdAt: -1 })
      .skip(skipLedger)
      .limit(ledgerLimit)
      .lean();

    const purchases = await Purchase.find({
      "purchasedItems.item_id": item._id,
    }).lean();

    // Flatten all purchased items for this item
    const purchasedItems = purchases.flatMap((p) =>
      p.purchasedItems.filter((pi) => String(pi.item_id) === String(item._id))
    );

    // Last purchase selling price
    const lastPurchaseSellingPrice = purchasedItems.length
      ? purchasedItems[purchasedItems.length - 1].sellingPrice
      : 0;

    // Lowest and highest selling price
    const sellingPrices = purchasedItems.map((pi) => pi.sellingPrice);
    const lowestSellingPrice = sellingPrices.length
      ? Math.min(...sellingPrices)
      : 0;
    const highestSellingPrice = sellingPrices.length
      ? Math.max(...sellingPrices)
      : 0;

    // Last unit cost
    const lastUnitCost = purchasedItems.length
      ? purchasedItems[purchasedItems.length - 1].unitCost
      : 0;

    // ---------------------------------------------------
    // 5. FETCH SALES HISTORY (Last 50)
    // ---------------------------------------------------
    const salesHistory = await SalesInvoice.aggregate([
      { $match: { "items.item_id": new mongoose.Types.ObjectId(itemId) } },
      { $sort: { invoice_date: -1 } },
      { $limit: 50 },
      { $lookup: { from: "customers", localField: "customer", foreignField: "_id", as: "customer" } },
      { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          invoice_id: 1,
          invoice_date: 1,
          customer: { firstName: 1, lastName: 1, phone: 1 },
          // Extract specific item details from the array
          items: {
            $filter: {
              input: "$items",
              as: "item",
              cond: { $eq: ["$$item.item_id", new mongoose.Types.ObjectId(itemId)] }
            }
          }
        }
      }
    ]);

    // ---------------------------------------------------
    // 6. SERIALIZED BATCHES AGGREGATION
    // ---------------------------------------------------
    let serializedBatches = [];
    if (item.serialized) {
      serializedBatches = await SerializedStock.aggregate([
        { $match: { item_id: new mongoose.Types.ObjectId(itemId) } },
        {
          $group: {
            _id: "$batch_number",
            batch_number: { $first: "$batch_number" },
            purchase_id: { $first: "$purchase_id" },
            unitCost: { $first: "$unitCost" },
            sellingPrice: { $first: "$sellingPrice" },
            totalQty: { $sum: 1 },
            availableQty: { $sum: { $cond: [{ $eq: ["$status", "Available"] }, 1, 0] } },
            soldQty: { $sum: { $cond: [{ $eq: ["$status", "Sold"] }, 1, 0] } }
          }
        },
        {
          $lookup: { from: "purchases", localField: "purchase_id", foreignField: "_id", as: "purchase" }
        },
        { $unwind: { path: "$purchase", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "suppliers",
            localField: "purchase.supplier",
            foreignField: "_id",
            as: "supplier",
          },
        },
        { $unwind: { path: "$supplier", preserveNullAndEmptyArrays: true } },
        { $sort: { "_id": -1 } } // Sort by batch number desc (usually date based)
      ]);
    }

    // ---------------------------------------------------
    // 7. FINAL STRUCTURED RESPONSE
    // ---------------------------------------------------
    res.json({
      item: {
        ...item,
        lastUnitCost,
        lastPurchaseSellingPrice,
        lowestSellingPrice,
        highestSellingPrice,
        totalAvailable:
          serialized.length +
          nonSerialized.reduce((acc, b) => acc + b.availableQty, 0),
      },
      inStock: item.serialized
        ? serialized
          .filter(x => x.status === "Available")
          .sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate))
        : nonSerialized
          .filter(x => x.availableQty > 0)
          .sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate)),

      variants,
      nonSerializedBatches: nonSerialized,
      serializedItems: serialized,
      serializedBatches, // NEW
      salesHistory,      // NEW
      imeiTotal,
      ledger,
      ledgerTotal,
    });
  } catch (err) {
    res.status(500).json({ message: "Error retrieving stock detail" });
  }
};

exports.adjustStock = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { itemId, variantId, adjustmentType, adjustmentQty, reason, targetSerialNumbers, newSerialNumbers, unitCost, sellingPrice, supplierId } = req.body;
    // adjustmentQty is treated as absolute count for NonSerialized (or difference?)
    // Modal UI sends "Qty" as "Difference" (Action Qty).
    // targetSerialNumbers: ["SN1", "SN2"] (for Deduct)
    // newSerialNumbers: [{ serialNumber: "SN3", unitCost: 100, sellingPrice: 150 }] (for Add)

    const item = await Items.findById(itemId).session(session);
    if (!item) throw new Error("Item not found");

    // Helper: Create Purchase Record if Supplier is provided for "Add"
    let purchaseId = new mongoose.Types.ObjectId(); // Default placeholder (virtual)

    if (adjustmentType !== "Deduct" && supplierId) {
      // Create a real Purchase record to link this Stock Adjustment to a Supplier
      const purchaseEntry = await Purchase.create([{
        supplier: supplierId,
        referenceNumber: "ADJ-" + moment().format("YYMMDD-HHmmss"),
        purchaseDate: new Date(),
        purchase_status: "Received",
        verification_status: "Verified", // Auto-verify adjustment
        total_items_count: adjustmentQty || newSerialNumbers?.length || 0,
        grand_total: (parseFloat(unitCost) || 0) * (adjustmentQty || newSerialNumbers?.length || 0),
        purchasedItems: [{ // Minimal item structure
          item_id: itemId,
          purchaseQty: adjustmentQty || newSerialNumbers?.length || 1,
          unitCost: parseFloat(unitCost) || 0,
          sellingPrice: parseFloat(sellingPrice) || 0,
          total_price: (parseFloat(unitCost) || 0) * (adjustmentQty || newSerialNumbers?.length || 1),
          batch_number: "ADJ-" + moment().format("YYMMDD"),
          isSerialized: item.serialized
        }]
      }], { session });
      purchaseId = purchaseEntry[0]._id;

      // --- FINANCIAL INTEGRATION: Update Supplier Account ---
      const partyAcc = await Account.findOne({
        account_owner_type: "Supplier",
        related_party_id: supplierId,
      }).session(session);

      if (partyAcc) {
        const totalValue = (parseFloat(unitCost) || 0) * (adjustmentQty || newSerialNumbers?.length || 0);
        partyAcc.balance -= totalValue;
        await partyAcc.save({ session });

        await Transaction.create(
          [
            {
              account_id: partyAcc._id,
              amount: totalValue * -1,
              transaction_type: "Withdrawal",
              reason: `Stock Adjustment (${reason}): ${purchaseId}`,
              balance_after_transaction: partyAcc.balance,
            },
          ],
          { session }
        );
      }
    }

    if (item.serialized) {
      if (adjustmentType === "Deduct") {
        if (!targetSerialNumbers || targetSerialNumbers.length === 0) {
          throw new Error("Serialized items require specific serial numbers to deduct.");
        }

        // Update Status of these serials
        const updateResult = await SerializedStock.updateMany(
          { serialNumber: { $in: targetSerialNumbers }, item_id: itemId, status: "Available" },
          { $set: { status: reason, notes: `Adjustment: ${reason}`, sold_date: new Date() } }, // Marking sold_date as well? No, maybe just status.
          { session }
        );

        if (updateResult.modifiedCount !== targetSerialNumbers.length) {
          throw new Error(`Could not find all specified serials in 'Available' status. Updated ${updateResult.modifiedCount} of ${targetSerialNumbers.length}.`);
        }

        // Log Ledger for each
        for (const sn of targetSerialNumbers) {
          const previousLedger = await StockLedger.findOne({ item_id: itemId })
            .sort({ createdAt: -1 })
            .session(session)
            .lean();

          await StockLedger.create([{
            item_id: itemId,
            movementType: "Adjustment-Out",
            qty: -1,
            serialNumber: sn,
            memo: `Adjustment: ${reason}`,
            opening_balance: previousLedger?.closing_balance || 0,
            closing_balance: (previousLedger?.closing_balance || 0) - 1,
          }], { session });
        }

      } else { // Add (Correction/Found)
        // Check if we are just adding "count" (not allowed for serialized)
        // Logic: User must provide serials.
        if (newSerialNumbers && newSerialNumbers.length > 0) {
          for (const entry of newSerialNumbers) {
            // Check if exists
            const exists = await SerializedStock.findOne({ serialNumber: entry.serialNumber, item_id: itemId }).session(session);
            if (exists) {
              if (exists.status !== 'Available') {
                // Reactivate
                exists.status = 'Available';
                exists.notes = `Stock Correction: ${reason}`;
                await exists.save({ session });
              } else {
                throw new Error(`Serial ${entry.serialNumber} is already Available.`);
              }
            } else {
              // Create New
              await SerializedStock.create([{
                item_id: itemId,
                variant_id: entry.variant_id || null,
                serialNumber: entry.serialNumber,
                batch_number: "ADJ-" + moment().format("YYMMDD"),
                status: "Available",
                // PRIORITIZE: Serial Specific > Global Input > Item Last Known
                unitCost: entry.unitCost || parseFloat(unitCost) || item.lastUnitCost || 0,
                sellingPrice: entry.sellingPrice || parseFloat(sellingPrice) || item.pricing?.sellingPrice || 0,
                purchaseDate: new Date(),
                purchase_id: purchaseId, // Use the real or placeholder ID
                condition: entry.condition || item.condition || "Brand New"
              }], { session });
            }

            const previousLedger = await StockLedger.findOne({ item_id: itemId })
              .sort({ createdAt: -1 })
              .session(session)
              .lean();

            await StockLedger.create([{
              item_id: itemId,
              movementType: "Adjustment-In",
              qty: 1,
              serialNumber: entry.serialNumber,
              memo: `Adjustment: ${reason}`,
              opening_balance: previousLedger?.closing_balance || 0,
              closing_balance: (previousLedger?.closing_balance || 0) + 1,
              condition: entry.condition || "Brand New"
            }], { session });
          }
        } else {
          // Fallback: If user didn't provide serials but provided Qty, throw error
          throw new Error("Cannot add serialized stock without specific Serial Numbers.");
        }
      }
    } else {
      // Non-Serialized
      const qty = parseInt(adjustmentQty);
      if (adjustmentType === "Deduct") {
        // FIFO Deduct
        let remaining = qty;
        const batches = await NonSerializedStock.find({ item_id: itemId, availableQty: { $gt: 0 } }).sort({ purchaseDate: 1 }).session(session);

        for (const batch of batches) {
          if (remaining <= 0) break;
          const deduct = Math.min(batch.availableQty, remaining);
          batch.availableQty -= deduct;
          batch.adjustmentQty += deduct;
          batch.adjustment_reason = reason;
          // Ensure condition exists to satisfy schema validation for older records
          if (!batch.condition) batch.condition = "Brand New";
          await batch.save({ session });
          remaining -= deduct;
        }

        if (remaining > 0) {
          throw new Error("Insufficient stock for deduction.");
        }

        const previousLedger = await StockLedger.findOne({ item_id: itemId })
          .sort({ createdAt: -1 })
          .session(session)
          .lean();

        await StockLedger.create([{
          item_id: itemId,
          movementType: "Adjustment-Out",
          qty: -qty,
          memo: `Adjustment: ${reason}`,
          opening_balance: previousLedger?.closing_balance || 0,
          closing_balance: (previousLedger?.closing_balance || 0) - qty,
        }], { session });

      } else {
        // Add
        // Update Item Master's Last Cost/Price if provided
        if (unitCost || sellingPrice) {
          if (unitCost) item.costPrice = parseFloat(unitCost);
          if (sellingPrice) {
            if (!item.pricing) item.pricing = {};
            item.pricing.sellingPrice = parseFloat(sellingPrice);
          }
          await item.save({ session });
        }

        await NonSerializedStock.create([{
          item_id: itemId,
          variant_id: variantId || null,
          batch_number: "ADJ-" + moment().format("YYMMDD"),
          purchaseQty: qty,
          availableQty: qty,
          // PRIORITIZE: Global Input > Item Last Known
          unitCost: parseFloat(unitCost) || item.lastUnitCost || 0,
          sellingPrice: parseFloat(sellingPrice) || item.pricing?.sellingPrice || 0,
          condition: req.body.condition || item.condition || "Brand New",
          purchaseDate: new Date(),
          purchase_id: purchaseId, // Use the real or placeholder ID
        }], { session });

        const previousLedger = await StockLedger.findOne({ item_id: itemId })
          .sort({ createdAt: -1 })
          .session(session)
          .lean();

        await StockLedger.create([{
          item_id: itemId,
          movementType: "Adjustment-In",
          qty: qty,
          memo: `Adjustment: ${reason}`,
          opening_balance: previousLedger?.closing_balance || 0,
          closing_balance: (previousLedger?.closing_balance || 0) + qty,
        }], { session });
      }
    }

    await AuditLog.create([{
      action: "STOCK_ADJUSTED",
      performedBy: req.user?._id,
      description: `Stock adjusted for item ${item.itemName} (${adjustmentType}): ${reason}`,
      after: { itemId, adjustmentType, adjustmentQty, reason }
    }], { session });

    await session.commitTransaction();
    res.json({ message: "Stock adjusted successfully" });
  } catch (error) {
    await session.abortTransaction();
    console.error("Stock Adjustment Error:", error);
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};


exports.getItemSalesHistory = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { variantId, limit = 10, page = 1 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ message: "Invalid itemId format" });
    }

    const matchQuery = {
      "items.item_id": new mongoose.Types.ObjectId(itemId),
      transaction_type: "Sale"
    };

    const sales = await SalesInvoice.aggregate([
      { $unwind: "$items" },
      { $match: matchQuery },
      {
        $lookup: {
          from: "customers",
          localField: "customer",
          foreignField: "_id",
          as: "customerInfo"
        }
      },
      { $unwind: { path: "$customerInfo", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          invoice_id: 1,
          invoice_date: 1,
          customer_name: {
            $concat: [
              { $ifNull: ["$customerInfo.first_name", ""] },
              " ",
              { $ifNull: ["$customerInfo.last_name", ""] }
            ]
          },
          quantity: "$items.quantity",
          price: "$items.price",
          totalPrice: "$items.totalPrice",
          batch_number: "$items.batch_number",
          serialNumbers: "$items.serialNumbers",
          isSerialized: "$items.isSerialized"
        }
      },
      { $sort: { invoice_date: -1 } },
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) }
    ]);

    const totalCount = await SalesInvoice.countDocuments(matchQuery);

    return res.status(200).json({
      sales,
      totalCount,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error("Error fetching sales history:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getStockMovementDashboardData = async (req, res) => {
  try {
    const todayStart = moment().startOf('day').toDate();
    const monthStart = moment().startOf('month').toDate();
    const yearStart = moment().startOf('year').toDate();

    // 1. INCOMING (Purchases - Received)
    const incomingMatch = { purchase_status: "Received" };
    const incomingAgg = await Purchase.aggregate([
      { $match: incomingMatch },
      {
        $facet: {
          today: [
            { $match: { purchaseDate: { $gte: todayStart } } },
            { $group: { _id: null, count: { $sum: "$total_items_count" }, value: { $sum: "$grand_total" } } }
          ],
          thisMonth: [
            { $match: { purchaseDate: { $gte: monthStart } } },
            { $group: { _id: null, count: { $sum: "$total_items_count" }, value: { $sum: "$grand_total" } } }
          ],
          thisYear: [
            { $match: { purchaseDate: { $gte: yearStart } } },
            { $group: { _id: null, count: { $sum: "$total_items_count" }, value: { $sum: "$grand_total" } } }
          ],
          allTime: [
            { $group: { _id: null, count: { $sum: "$total_items_count" }, value: { $sum: "$grand_total" } } }
          ],
          trends: [
            { $match: { purchaseDate: { $gte: moment().subtract(6, 'months').startOf('month').toDate() } } },
            {
              $group: {
                _id: { month: { $month: "$purchaseDate" }, year: { $year: "$purchaseDate" } },
                count: { $sum: "$total_items_count" },
                value: { $sum: "$grand_total" },
                date: { $first: "$purchaseDate" }
              }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
          ]
        }
      }
    ]);

    // 2. OUTGOING (Sales)
    const outgoingAgg = await SalesInvoice.aggregate([
      {
        $facet: {
          today: [
            { $match: { invoice_date: { $gte: todayStart } } },
            { $unwind: "$items" },
            { $group: { _id: null, count: { $sum: "$items.quantity" }, value: { $sum: "$items.totalPrice" } } }
          ],
          thisMonth: [
            { $match: { invoice_date: { $gte: monthStart } } },
            { $unwind: "$items" },
            { $group: { _id: null, count: { $sum: "$items.quantity" }, value: { $sum: "$items.totalPrice" } } }
          ],
          thisYear: [
            { $match: { invoice_date: { $gte: yearStart } } },
            { $unwind: "$items" },
            { $group: { _id: null, count: { $sum: "$items.quantity" }, value: { $sum: "$items.totalPrice" } } }
          ],
          allTime: [
            { $unwind: "$items" },
            { $group: { _id: null, count: { $sum: "$items.quantity" }, value: { $sum: "$items.totalPrice" } } }
          ],
          trends: [
            { $match: { invoice_date: { $gte: moment().subtract(6, 'months').startOf('month').toDate() } } },
            { $unwind: "$items" },
            {
              $group: {
                _id: { month: { $month: "$invoice_date" }, year: { $year: "$invoice_date" } },
                count: { $sum: "$items.quantity" },
                value: { $sum: "$items.totalPrice" },
                date: { $first: "$invoice_date" }
              }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
          ]
        }
      }
    ]);

    // 3. PIPELINE (Pending Verification)
    const pipeline = await Purchase.aggregate([
      { $match: { purchase_status: "Pending Verification" } },
      { $group: { _id: null, count: { $sum: "$total_items_count" }, value: { $sum: "$grand_total" }, items: { $sum: 1 } } }
    ]);

    res.json({
      incoming: incomingAgg[0],
      outgoing: outgoingAgg[0],
      pipeline: pipeline[0] || { count: 0, value: 0, items: 0 }
    });

  } catch (error) {
    console.error("Dashboard Data Error:", error);
    res.status(500).json({ message: "Error fetching dashboard data" });
  }
};

exports.backfillLedger = async (req, res) => {
  try {
    const items = await Item.find().lean();
    let totalCreated = 0;

    for (const item of items) {
      // 1. Get all movements for this item
      // Purchases (Received/Discrepancy)
      const purchases = await Purchase.find({
        "purchasedItems.item_id": item._id,
        purchase_status: { $in: ["Received", "Discrepancy"] }
      }).lean();

      // Sales
      const sales = await SalesInvoice.find({
        "items.item_id": item._id,
        transaction_type: "Sale"
      }).lean();

      // 2. Prepare chronological events
      const events = [];

      purchases.forEach(p => {
        const pItem = p.purchasedItems.find(i => String(i.item_id) === String(item._id));
        if (pItem) {
          events.push({
            date: p.verification_date || p.purchaseDate || p.createdAt,
            type: "Purchase-In",
            qty: pItem.purchaseQty || (pItem.serializedItems?.length || 0),
            purchase_id: p._id,
            batch_number: pItem.batch_number,
            unitCost: pItem.unitCost,
            sellingPrice: pItem.sellingPrice,
            memo: `Backfill: Purchase ${p.referenceNumber}`,
            serializedUnits: pItem.isSerialized ? pItem.serializedItems : []
          });
        }
      });

      sales.forEach(s => {
        const sItems = s.items.filter(i => String(i.item_id) === String(item._id));
        sItems.forEach(si => {
          events.push({
            date: s.invoice_date || s.createdAt,
            type: "Sale-Out",
            qty: -si.quantity,
            memo: `Backfill: Sale ${s.invoice_number}`,
            serialNumbers: si.serialNumbers || []
          });
        });
      });

      // Sort by date ASC
      events.sort((a, b) => new Date(a.date) - new Date(b.date));

      // 3. Reconstruct Ledger (WIPE existing for clean slate during maintenance)
      await StockLedger.deleteMany({ item_id: item._id });
      let balance = 0;

      for (const ev of events) {
        if (ev.serializedUnits && ev.serializedUnits.length > 0) {
          // Serialized Purchase-In
          for (const unit of ev.serializedUnits) {
            const entry = {
              item_id: item._id,
              variant_id: unit.variant_id || null,
              purchase_id: ev.purchase_id,
              serialNumber: unit.serialNumber,
              movementType: ev.type,
              qty: 1,
              opening_balance: balance,
              closing_balance: balance + 1,
              batch_number: ev.batch_number,
              unitCost: unit.unitCost,
              sellingPrice: unit.sellingPrice,
              memo: ev.memo,
              createdAt: ev.date
            };
            await StockLedger.create(entry);
            balance += 1;
            totalCreated++;
          }
        } else if (ev.serialNumbers && ev.serialNumbers.length > 0) {
          // Serialized Sale-Out
          for (const sn of ev.serialNumbers) {
            const entry = {
              item_id: item._id,
              movementType: ev.type,
              qty: -1,
              serialNumber: sn,
              opening_balance: balance,
              closing_balance: balance - 1,
              memo: ev.memo,
              createdAt: ev.date
            };
            await StockLedger.create(entry);
            balance -= 1;
            totalCreated++;
          }
        } else {
          // Non-Serialized
          const entry = {
            item_id: item._id,
            movementType: ev.type,
            qty: ev.qty,
            opening_balance: balance,
            closing_balance: balance + ev.qty,
            batch_number: ev.batch_number,
            unitCost: ev.unitCost,
            sellingPrice: ev.sellingPrice,
            memo: ev.memo,
            createdAt: ev.date
          };
          await StockLedger.create(entry);
          balance += ev.qty;
          totalCreated++;
        }
      }
    }
    res.json({ message: "Backfill completed", totalCreated });
  } catch (error) {
    console.error("Backfill Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Stock Statistics for Dashboard
exports.getStockStatistics = async (req, res) => {
  try {
    // 1. Identify all trackable SKUs (Legacy Base Items with NO variants + All Variant records)
    const [allVariants, allItems] = await Promise.all([
      ItemVariant.find({}, 'item_id').lean(),
      Items.find({}, '_id').lean()
    ]);

    const itemsWithVariants = new Set(allVariants.map(v => v.item_id.toString()));
    const legacyItems = allItems.filter(i => !itemsWithVariants.has(i._id.toString()));

    // Total Trackable SKUs = All Variants + Base Items that have no variants
    const totalSKUs = allVariants.length + legacyItems.length;

    // 2. Identify Purchased SKUs (Those appearing in Stock records)
    const [serItems, nonSerItems] = await Promise.all([
      SerializedStock.aggregate([
        { $group: { _id: { item_id: "$item_id", variant_id: "$variant_id" } } }
      ]),
      NonSerializedStock.aggregate([
        { $group: { _id: { item_id: "$item_id", variant_id: "$variant_id" } } }
      ])
    ]);

    const purchasedSKUs = new Set();
    const addSKU = (doc) => {
      const { item_id, variant_id } = doc._id;
      // If variant_id exists, the SKU is the variant. Else it's the base item.
      purchasedSKUs.add(variant_id ? variant_id.toString() : item_id.toString());
    };
    serItems.forEach(addSKU);
    nonSerItems.forEach(addSKU);

    const purchasedCount = purchasedSKUs.size;

    // 3. Detailed calculation for InStock / LowStock / OutStock
    // We aggregate stock by (item_id, variant_id) pair to match the "Unified" view logic
    const [serializedAgg, nonSerializedAgg] = await Promise.all([
      SerializedStock.aggregate([
        { $match: { status: "Available" } },
        {
          $group: {
            _id: { item_id: "$item_id", variant_id: "$variant_id" },
            qty: { $sum: 1 }
          }
        }
      ]),
      NonSerializedStock.aggregate([
        { $match: { status: "Available" } },
        {
          $group: {
            _id: { item_id: "$item_id", variant_id: "$variant_id" },
            qty: { $sum: "$availableQty" }
          }
        }
      ])
    ]);

    // Map quantities to SKU string
    const skuQtyMap = {};
    const processAgg = (agg) => {
      agg.forEach(doc => {
        const key = doc._id.variant_id ? doc._id.variant_id.toString() : doc._id.item_id.toString();
        skuQtyMap[key] = (skuQtyMap[key] || 0) + doc.qty;
      });
    };
    processAgg(serializedAgg);
    processAgg(nonSerializedAgg);

    // 4. Categorize SKUs based on Alert Quantity from Base Item
    // Fetch all items to get alert quantities
    const itemMap = allItems.reduce((acc, i) => {
      acc[i._id.toString()] = i;
      return acc;
    }, {});

    // For variants, we need the parent item's alert quantity
    const variantToItemMap = allVariants.reduce((acc, v) => {
      acc[v._id.toString()] = v.item_id.toString();
      return acc;
    }, {});

    let inStock = 0, lowStock = 0, outStock = 0;

    purchasedSKUs.forEach(skuId => {
      const qty = skuQtyMap[skuId] || 0;

      // Get Parent Item ID
      const parentItemId = variantToItemMap[skuId] || skuId;
      const parentItem = itemMap[parentItemId];
      const alertQty = parentItem ? parseInt(parentItem.alertQuantity || 0) : 0;

      if (qty <= 0) outStock++;
      else {
        inStock++; // Available = Any items with stock > 0
        if (qty <= alertQty) lowStock++; // Low Stock = Subset of items with stock
      }
    });

    res.json({
      totalItems: totalSKUs,
      purchased: purchasedCount,
      neverPurchased: totalSKUs - purchasedCount,
      inStock,
      lowStock,
      outStock
    });
  } catch (error) {
    console.error('Stock Statistics Error:', error);
    res.status(500).json({ message: 'Error calculating stock statistics', error: error.message });
  }
};

exports.backfillItemsWithNoPurchaseHistory = async (req, res) => {
  // logic to fix any data inconsistencies if needed
};
/**
 * getBarcodeDataByPurchase:
 * Fetches authoritative data (barcodes, actual batch numbers, serials)
 * for items in a specific purchase, prepared for PrintableLabels.
 */
exports.getBarcodeDataByPurchase = async (req, res) => {
  try {
    const { purchaseId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(purchaseId)) {
      return res.status(400).json({ message: "Invalid purchaseId" });
    }

    // 1. Fetch both stock types for this purchase
    const [nonSer, ser] = await Promise.all([
      NonSerializedStock.find({ purchase_id: purchaseId })
        .populate("item_id", "itemName barcode category itemImage")
        .populate("variant_id", "variantName barcode variantAttributes")
        .lean(),
      SerializedStock.find({ purchase_id: purchaseId })
        .populate("item_id", "itemName barcode category itemImage")
        .populate("variant_id", "variantName barcode variantAttributes")
        .lean()
    ]);

    // 2. Normalize Non-Serialized Stock
    const nonSerGrouped = nonSer.map(stock => ({
      _id: `${stock.item_id?._id}_${stock.variant_id?._id || 'base'}`,
      item_id: stock.item_id?._id,
      variant_id: stock.variant_id?._id,
      itemName: stock.variant_id?.variantName || stock.item_id?.itemName,
      barcode: stock.variant_id?.barcode || stock.item_id?.barcode,
      category: stock.item_id?.category,
      itemImage: stock.item_id?.itemImage,
      totalStock: stock.purchaseQty,
      serialized: false,
      lastSellingPrice: stock.sellingPrice,
      batches: [{
        batch_number: stock.batch_number,
        availableQty: stock.purchaseQty,
        unitCost: stock.unitCost,
        sellingPrice: stock.sellingPrice,
        purchaseDate: stock.purchaseDate
      }]
    }));

    // 3. Normalize Serialized Stock (Group by Item/Variant)
    const serGroupedMap = ser.reduce((acc, stock) => {
      const key = `${stock.item_id?._id}_${stock.variant_id?._id || 'base'}`;
      if (!acc[key]) {
        acc[key] = {
          _id: key,
          item_id: stock.item_id?._id,
          variant_id: stock.variant_id?._id,
          itemName: stock.variant_id?.variantName || stock.item_id?.itemName,
          barcode: stock.variant_id?.barcode || stock.item_id?.barcode,
          category: stock.item_id?.category,
          itemImage: stock.item_id?.itemImage,
          lastSellingPrice: stock.sellingPrice,
          totalStock: 0,
          serialized: true,
          serializedItems: [],
          batches: []
        };
      }

      acc[key].totalStock += 1;
      acc[key].serializedItems.push({
        serialNumber: stock.serialNumber,
        unitCost: stock.unitCost,
        category: stock.item_id?.category,
        sellingPrice: stock.sellingPrice,
        condition: stock.condition,
        batteryHealth: stock.batteryHealth,
        batch_number: stock.batch_number
      });

      // Maintain batch summary
      let batch = acc[key].batches.find(b => b.batch_number === stock.batch_number);
      if (!batch) {
        batch = {
          batch_number: stock.batch_number,
          availableQty: 0,
          unitCost: stock.unitCost,
          sellingPrice: stock.sellingPrice,
          purchaseDate: stock.purchaseDate
        };
        acc[key].batches.push(batch);
      }
      batch.availableQty += 1;

      return acc;
    }, {});

    const serGrouped = Object.values(serGroupedMap);

    res.status(200).json([...nonSerGrouped, ...serGrouped]);
  } catch (err) {
    console.error("🔥 getBarcodeDataByPurchase ERROR:", err);
    res.status(500).json({ message: "Error fetching barcode data", error: err.message });
  }
};
