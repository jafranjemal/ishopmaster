// controllers/dashboardV2Controller.js
const mongoose = require("mongoose");
const Purchase = require("../models/Purchase");
const Sale = require("../models/SalesInvoice");
const SerializedStock = require("../models/SerializedStock");
const NonSerializedStock = require("../models/NonSerializedStock");
const Transaction = require("../models/Transaction");
const Repair = require("../models/RepairOrder");
const Customer = require("../models/Customer");
const redisClient = require("../lib/redis");

// parse time ranges
const parseRange = (range = "today") => {
  const now = new Date();
  let start;
  switch (range) {
    case "today":
      start = new Date(now); start.setHours(0,0,0,0); break;
    case "week":
      start = new Date(now); start.setDate(now.getDate() - 6); start.setHours(0,0,0,0); break;
    case "month":
      start = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case "year":
      start = new Date(now.getFullYear(), 0, 1); break;
    default:
      start = new Date(0);
  }
  return { start, end: now };
};
const dateGroup = (field, period="daily") => {
  if (period === "daily") return { year: { $year: `$${field}` }, month: { $month: `$${field}` }, day: { $dayOfMonth: `$${field}` } };
  if (period === "monthly") return { year: { $year: `$${field}` }, month: { $month: `$${field}` } };
};

const calculateGrowth = (current, previous) => {
  if (previous === 0) return 100;
  return ((current - previous) / previous) * 100;
};

exports.overview = async (req, res) => {
  try {
    const { range = "today" } = req.query;
    const { start, end } = parseRange(range);

    const cacheKey = `dashboard:v2:${range}`;
    if (redisClient) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return res.json(JSON.parse(cached));
    }

    // --- SALES AGGREGATION ---
// --- SALES AGGREGATION ---
const salesAgg = await Sale.aggregate([
  // 1. Match sales within the date range and exclude 'Reversed' status
  { $match: { invoice_date: { $gte: start, $lte: end }, status: { $ne: "Reversed" } } },
  
  // 2. Unwind the items array to process cost for each item
  { $unwind: "$items" },
  
  // 3. Project necessary fields for cost lookup
  { $project: {
      orderId: "$_id", // Keep the original Sale document ID
      totalSaleAmount: "$total_amount", // Total amount of the sale
      totalPaidAmount: "$total_paid_amount", // Total paid amount of the sale
      item_id: "$items.item_id",
      itemSellingPrice: "$items.price", // Unit Selling Price (Revenue)
      quantity: "$items.quantity",
      isSerialized: "$items.isSerialized",
      serialNumbers: "$items.serialNumbers",
      batch_number: "$items.batch_number"
  } },

  // 4. Look up the Unit Cost from the 'purchases' collection (FIXED)
{ $lookup: {
    from: "purchases", // Name of your Purchase collection
    let: { 
        item_id: "$item_id", 
        is_serialized: "$isSerialized", 
        serials: "$serialNumbers", 
        batch: "$batch_number" 
    },
    pipeline: [
        // 1. Unwind purchasedItems to make them individual documents
        { $unwind: "$purchasedItems" },

        // 2. Match the current unwound purchase item against the sale item_id
        { $match: { $expr: { $eq: ["$purchasedItems.item_id", "$$item_id"] } } },
        
        // 3. Project and match the batch/serial number
        { $project: { 
            unitCost: "$purchasedItems.unitCost", 
            isMatch: { 
                $cond: { 
                    if: "$$is_serialized", 
                    // FIX: Use $setIntersection to check for ANY overlap
                    then: { $gt: [ { $size: { $setIntersection: ["$$serials", "$purchasedItems.serializedItems"] } }, 0 ] },
                    // Non-serialized items require an exact batch match
                    else: { $eq: ["$purchasedItems.batch_number", "$$batch"] }
                } 
            } 
        } },
        
        // 4. Filter to keep only the matching item cost
        { $match: { isMatch: true } }, 
        
        // 5. Return the unitCost
        { $limit: 1 }, 
        { $project: { _id: 0, unitCost: 1 } }
    ],
    as: "costData"
} },

  // 5. Calculate Cost of Goods Sold (COGS) for the single item
  { $addFields: {
      unitCost: { $ifNull: [{ $arrayElemAt: ["$costData.unitCost", 0] }, 0] },
      itemCOGS: { $multiply: ["$quantity", { $ifNull: [{ $arrayElemAt: ["$costData.unitCost", 0] }, 0] }] }
  } },
  
  // 6. Group back by the original Sale document ID
  // This step sums up the COGS for all items within a single sale.
  { $group: {
      _id: "$orderId", // Group by the original Sale ID
      totalSales: { $first: "$totalSaleAmount" }, // Take the full amount from the first item
      totalPaid: { $first: "$totalPaidAmount" }, // Take the paid amount from the first item
      totalCostPerOrder: { $sum: "$itemCOGS" }, // Sum the calculated COGS for all items in the sale
      
      // Pass max/min sales fields to the next stage
      maxSale: { $first: "$totalSaleAmount" },
      minSale: { $first: "$totalSaleAmount" }
  } },
  
  // 7. Final Group to aggregate all sales data (this is the equivalent of your original group)
  { $group: {
      _id: null,
      totalSales: { $sum: "$totalSales" },
      totalCost: { $sum: "$totalCostPerOrder" }, // Use the calculated total cost per order
      totalPaid: { $sum: "$totalPaid" },
      orders: { $sum: 1 }, // Count the number of unique orders
      
      // Calculate Net Profit using the calculated fields
      netProfit: { $sum: { $subtract: ["$totalSales", "$totalCostPerOrder"] } },
      
      // Find the overall max/min from the total sales amounts
      maxSale: { $max: "$maxSale" },
      minSale: { $min: "$minSale" }
  } }
]);


    const sales = salesAgg[0] || { totalSales:0, totalCost:0, totalPaid:0, orders:0, netProfit:0, maxSale:0, minSale:0 };

    const dailySalesTrend = await Sale.aggregate([
    // 1. Match sales
    { $match: { invoice_date: { $gte: start, $lte: end }, status: { $ne: "Reversed" } } },
    
    // 2. Unwind items and project necessary fields
    { $unwind: "$items" },
    { $project: {
        _id: dateGroup("invoice_date", "daily"),
        revenue: { $multiply: ["$items.price", "$items.quantity"] },
        item_id: "$items.item_id",
        quantity: "$items.quantity",
        isSerialized: "$items.isSerialized",
        serialNumbers: "$items.serialNumbers",
        batch_number: "$items.batch_number"
    } },

     // 4. Look up the Unit Cost from the 'purchases' collection (FIXED)
{ $lookup: {
    from: "purchases", // Name of your Purchase collection
    let: { 
        item_id: "$item_id", 
        is_serialized: "$isSerialized", 
        serials: "$serialNumbers", 
        batch: "$batch_number" 
    },
    pipeline: [
        // 1. Unwind purchasedItems to make them individual documents
        { $unwind: "$purchasedItems" },

        // 2. Match the current unwound purchase item against the sale item_id
        { $match: { $expr: { $eq: ["$purchasedItems.item_id", "$$item_id"] } } },
        
        // 3. Project and match the batch/serial number
        { $project: { 
            unitCost: "$purchasedItems.unitCost", 
            isMatch: { 
                $cond: { 
                    if: "$$is_serialized", 
                    // FIX: Use $setIntersection to check for ANY overlap
                    then: { $gt: [ { $size: { $setIntersection: ["$$serials", "$purchasedItems.serializedItems"] } }, 0 ] },
                    // Non-serialized items require an exact batch match
                    else: { $eq: ["$purchasedItems.batch_number", "$$batch"] }
                } 
            } 
        } },
        
        // 4. Filter to keep only the matching item cost
        { $match: { isMatch: true } }, 
        
        // 5. Return the unitCost
        { $limit: 1 }, 
        { $project: { _id: 0, unitCost: 1 } }
    ],
    as: "costData"
} },
    
    // 4. Calculate COGS for the item
    { $addFields: {
        unitCost: { $ifNull: [{ $arrayElemAt: ["$costData.unitCost", 0] }, 0] },
        itemCOGS_per_sale_item: { 
            $multiply: [
                { $ifNull: [{ $arrayElemAt: ["$costData.unitCost", 0] }, 0] }, 
                "$quantity"
            ] 
        },
    } },

    // 5. Group by Day/Month/Year
    { $group: { 
        _id: "$_id",
        salesAmount: { $sum: "$revenue" },
        totalCOGS: { $sum: "$itemCOGS_per_sale_item" }, 
        
        profit: { $sum: { $subtract: ["$revenue", "$itemCOGS_per_sale_item"] } }
    } },
    
    // 6. Sort
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
]);
    
  // --- CORRECTED MONTHLY SALES & PROFIT TREND ---
// Note: This is redundant if you use monthlyFinancialTrend for sales and profit charting.
// If you want a separate monthly sales/profit chart, use this corrected pipeline:
const monthlySalesTrend = await Sale.aggregate([
    { $match: { invoice_date: { $gte: new Date(new Date().getFullYear(),0,1), $lte: end }, status: { $ne: "Reversed" } } },
    { $unwind: "$items" },
    { $project: {
        month: { $month: "$invoice_date" },
        year: { $year: "$invoice_date" },
        revenue: { $multiply: ["$items.price", "$items.quantity"] },
        item_id: "$items.item_id",
        quantity: "$items.quantity",
        isSerialized: "$items.isSerialized",
        serialNumbers: "$items.serialNumbers",
        batch_number: "$items.batch_number"
    } },
    
    // Look up Unit Cost from Purchases (identical logic)
    { $lookup: {
        from: "purchases",
        let: { item_id: "$item_id", is_serialized: "$isSerialized", serials: "$serialNumbers", batch: "$batch_number" },
        pipeline: [
            // ... (Same cost-finding logic as in salesAgg)
            { $match: { $expr: { $eq: ["$purchasedItems.item_id", "$$item_id"] } } },
            { $unwind: "$purchasedItems" },
            { $match: { $expr: { $eq: ["$purchasedItems.item_id", "$$item_id"] } } },
            { $project: { unitCost: "$purchasedItems.unitCost", isMatch: { $cond: { if: "$$is_serialized", then: { $setIsSubset: ["$$serials", "$purchasedItems.serializedItems"] }, else: { $eq: ["$purchasedItems.batch_number", "$$batch"] } } } } },
            { $match: { isMatch: true } },
            { $limit: 1 },
            { $project: { _id: 0, unitCost: 1 } }
        ],
        as: "costData"
    } },
    
    { $addFields: {
        unitCost: { $ifNull: [{ $arrayElemAt: ["$costData.unitCost", 0] }, 0] },
        itemCOGS: { $multiply: [{ $ifNull: [{ $arrayElemAt: ["$costData.unitCost", 0] }, 0] }, "$quantity"] },
    } },
    
    // Group by Month and Year
    { $group: { 
        _id: dateGroup("invoice_date", "monthly"), 
        salesAmount: { $sum: "$revenue" }, 
        profit: { $sum: { $subtract: ["$revenue", "$itemCOGS"] } } // Corrected Profit Calculation
    } },
    { $sort: { "_id.year": 1, "_id.month": 1 } }
]);

    // --- PURCHASE AGGREGATION ---
    const purchaseAgg = await Purchase.aggregate([
      { $match: { purchaseDate: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: null,
          totalPurchaseAmount: { $sum: "$grand_total" },
          totalItemsPurchased: { $sum: "$total_items_count" },
          purchaseCount: { $sum: 1 },
          totalPaidToSuppliers: { $sum: { $subtract: ["$grand_total","$payment_due_amount"] } },
          totalPurchaseDue: { $sum: "$payment_due_amount" }
        }
      }
    ]);
    const purchases = purchaseAgg[0] || { totalPurchaseAmount:0, totalItemsPurchased:0, purchaseCount:0, totalPaidToSuppliers:0, totalPurchaseDue:0 };

    const monthlyPurchaseTrend = await Purchase.aggregate([
      { $match: { purchaseDate: { $gte: new Date(new Date().getFullYear(),0,1), $lte: end } } },
      { $group: { _id: dateGroup("purchaseDate","monthly"), purchaseAmount: { $sum: "$grand_total" } } },
      { $sort: { "_id.year":1, "_id.month":1 } }
    ]);

    // --- TRANSACTIONS ---
    const transactionsAgg = await Transaction.aggregate([
      { $match: { transaction_date: { $gte: start, $lte: end } } },
      { $group: {
          _id: null,
          deposits: { $sum: { $cond: [ { $eq: ["$transaction_type","Deposit"] }, "$amount", 0 ] } },
          withdrawals: { $sum: { $cond: [ { $eq: ["$transaction_type","Withdrawal"] }, "$amount", 0 ] } },
          depositCount: { $sum: { $cond: [ { $eq: ["$transaction_type","Deposit"] }, 1, 0 ] } },
          withdrawalCount: { $sum: { $cond: [ { $eq: ["$transaction_type","Withdrawal"] }, 1, 0 ] } },
        } 
      }
    ]);
    const transactions = transactionsAgg[0] || { deposits:0, withdrawals:0, depositCount:0, withdrawalCount:0 };
    transactions.netCashFlow = transactions.deposits + transactions.withdrawals;

    // --- REPAIRS ---
    const repairAgg = await Repair.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: {
          _id: null,
          completed: { $sum: { $cond: [ { $eq: ["$status","Completed"] }, 1, 0 ] } },
          pending: { $sum: { $cond: [ { $in: ["$status", ["Received","InProgress","AwaitingParts"]] }, 1, 0 ] } },
          avgDurationMins: { $avg: "$durationMinutes" }
        } 
      }
    ]);
    const repairs = repairAgg[0] || { completed:0, pending:0, avgDurationMins:0 };

    // --- CUSTOMER KPIs ---
    const totalCustomers = await Customer.countDocuments({});
    const newCustomersThisPeriod = await Customer.countDocuments({ created_at: { $gte: start, $lte: end } });
    const topCustomers = await Sale.aggregate([
      { $match: { invoice_date: { $gte: start, $lte: end }, status: { $ne: "Reversed" } } },
      { $group: { _id: "$customer", totalPurchase: { $sum: "$total_amount" } } },
      { $sort: { totalPurchase: -1 } },
      { $limit: 10 },
      { $lookup: { from: "customers", localField: "_id", foreignField: "_id", as: "customer" } },
      { $unwind: "$customer" },
      { $project: { _id:0, customerName: "$customer.first_name", totalPurchase:1 } }
    ]);

    // --- INVENTORY ---
    const lowStockAgg = await NonSerializedStock.aggregate([
      { $group: { _id: "$item_id", totalAvailable: { $sum: "$availableQty" } } },
      { $lookup: { from: "items", localField: "_id", foreignField: "_id", as: "item" } },
      { $unwind: { path: "$item", preserveNullAndEmptyArrays:true } },
      { $match: { $expr: { $lte: ["$totalAvailable", { $ifNull: ["$item.alertQuantity", 0] }] } } },
      { $project: { itemName: "$item.itemName", totalAvailable:1 } }
    ]);
    const lowStockCount = lowStockAgg.length;
    const serializedAvailable = await SerializedStock.countDocuments({ status: "Available" });

     // --- GROWTH COMPARISON (vs previous period) ---
    const prevStart = new Date(start);
    const prevEnd = new Date(end);
    if(range === "year") prevStart.setFullYear(prevStart.getFullYear() - 1);
    else if(range === "month") prevStart.setMonth(prevStart.getMonth() - 1);
    else if(range === "week") prevStart.setDate(prevStart.getDate() - 7);
    else prevStart.setDate(prevStart.getDate() - 1);

   // --- CORRECTED PREVIOUS SALES AGGREGATION (for Growth Comparison) ---

   // --- CORRECTED PREVIOUS SALES AGGREGATION (for Growth Comparison) ---
const prevSalesAgg = await Sale.aggregate([
    // 1. Match the previous date range
    { $match: { invoice_date: { $gte: prevStart, $lte: prevEnd }, status: { $ne: "Reversed" } } },
    
    // 2. Unwind the items array
    { $unwind: "$items" },
    
    // 3. Project necessary fields for cost lookup
    { $project: {
        orderId: "$_id", 
        // Use the original total_amount from the Sale document
        totalSaleAmount: "$total_amount", 
        item_id: "$items.item_id",
        itemSellingPrice: "$items.price", // Unit Selling Price
        quantity: "$items.quantity",
        isSerialized: "$items.isSerialized",
        serialNumbers: "$items.serialNumbers",
        batch_number: "$items.batch_number"
    } },

    // 4. Look up the Unit Cost from the 'purchases' collection
    { $lookup: {
        from: "purchases", // Collection name: purchases
        let: { item_id: "$item_id", is_serialized: "$isSerialized", serials: "$serialNumbers", batch: "$batch_number" },
        pipeline: [
            // Logic to find the matching purchased item and its unitCost
            { $match: { $expr: { $eq: ["$purchasedItems.item_id", "$$item_id"] } } },
            { $unwind: "$purchasedItems" },
            { $match: { $expr: { $eq: ["$purchasedItems.item_id", "$$item_id"] } } },
            { $project: { unitCost: "$purchasedItems.unitCost", isMatch: { $cond: { if: "$$is_serialized", then: { $setIsSubset: ["$$serials", "$purchasedItems.serializedItems"] }, else: { $eq: ["$purchasedItems.batch_number", "$$batch"] } } } } },
            { $match: { isMatch: true } },
            { $limit: 1 },
            { $project: { _id: 0, unitCost: 1 } }
        ],
        as: "costData"
    } },

    // 5. Calculate Cost of Goods Sold (COGS) for the single item
    { $addFields: {
        unitCost: { $ifNull: [{ $arrayElemAt: ["$costData.unitCost", 0] }, 0] },
        itemCOGS: { $multiply: ["$quantity", { $ifNull: [{ $arrayElemAt: ["$costData.unitCost", 0] }, 0] }] }
    } },
    
    // 6. Group back by the original Sale document ID
    // This step totals COGS for the entire sale and keeps the total revenue.
    { $group: {
        _id: "$orderId",
        totalSales: { $first: "$totalSaleAmount" },
        totalCostPerOrder: { $sum: "$itemCOGS" },
    } },
    
    // 7. Final Group to get the total summary for the previous period
    { $group: {
        _id: null,
        totalSales: { $sum: "$totalSales" },
        totalCost: { $sum: "$totalCostPerOrder" },
        netProfit: { $sum: { $subtract: ["$totalSales", "$totalCostPerOrder"] } },
    } }
]);


    const prevSales = prevSalesAgg[0] || { totalSales:0, netProfit:0 };
    const salesGrowth = calculateGrowth(sales.totalSales, prevSales.totalSales);
    const profitGrowth = calculateGrowth(sales.netProfit, prevSales.netProfit);

// --- TOP 10 HIGHEST PROFIT SALES ITEMS ---
const topProfitSalesItems = await Sale.aggregate([
  // 1. Match sales within the date range and exclude 'Reversed' status
  { $match: { invoice_date: { $gte: start, $lte: end }, status: { $ne: "Reversed" } } },
  
  // 2. Deconstruct the items array to process each item individually
  { $unwind: "$items" }, 
  
  // --- START: Determine Unit Cost via Lookup ---
  
  // 3. Project necessary fields and the lookup key (serialNumbers or batch_number)
  { $project: {
      item_id: "$items.item_id",
      itemName: "$items.itemName",
      sellingPrice: "$items.price", // Assuming '$items.price' is the unit selling price
      quantity: "$items.quantity",
      isSerialized: "$items.isSerialized",
      serialNumbers: "$items.serialNumbers", // Array of serials for this item
      batch_number: "$items.batch_number"
  } },

  // 4. Look up the Purchase document to find the Cost (UnitCost)
  { $lookup: {
      from: "purchases", // The name of your Purchase collection
      let: { 
          item_id: "$item_id", 
          is_serialized: "$isSerialized", 
          serials: "$serialNumbers", 
          batch: "$batch_number" 
      },
      pipeline: [
          // Match the item_id in the purchasedItems array
          { $match: { 
              $expr: { 
                  $eq: ["$purchasedItems.item_id", "$$item_id"] 
              } 
          } },
          // Unwind the purchasedItems to check each one
          { $unwind: "$purchasedItems" },
          { $match: { 
              $expr: { 
                  $eq: ["$purchasedItems.item_id", "$$item_id"] 
              } 
          } },
          
          // --- Logic for finding the matching purchase item (the cost) ---
          { $project: {
              unitCost: "$purchasedItems.unitCost",
              isMatch: {
                  $cond: {
                      // IF serialized, check if ANY sale serial exists in the purchase's serializedItems
                      if: "$$is_serialized",
                      then: { $setIsSubset: ["$$serials", "$purchasedItems.serializedItems"] },
                      // IF NOT serialized, check if the batch_number matches
                      else: { $eq: ["$purchasedItems.batch_number", "$$batch"] }
                  }
              }
          } },
          // Keep only the item that matched based on batch or serials
          { $match: { isMatch: true } },
          // Select only the unitCost
          { $limit: 1 }, // Only need one matching cost
          { $project: { _id: 0, unitCost: 1 } }
      ],
      as: "costData"
  } },

  // 5. Extract the unitCost from the lookup result
  { $addFields: {
      // Get the unitCost from the first element of the costData array. Use 0 if not found (should not happen if logic is correct)
      unitCost: { $ifNull: [{ $arrayElemAt: ["$costData.unitCost", 0] }, 0] }
  } },

  // --- END: Determine Unit Cost via Lookup ---

  // 6. Calculate the Total Profit for the sale item: (Selling Price - Unit Cost) * Quantity
  { $addFields: {
      profit: { 
          $multiply: [
              { $subtract: ["$sellingPrice", "$unitCost"] }, 
              "$quantity"
          ] 
      }
  } },
  
  // 7. Group by item_id to aggregate the total profit
  { $group: {
      _id: "$item_id",
      itemName: { $first: "$itemName" },
      totalProfit: { $sum: "$profit" } 
  } },
  
  // 8. Sort and Limit
  { $sort: { totalProfit: -1 } },
  { $limit: 10 }
]);

// --- TOP 10 LOWEST PROFIT SALES ITEMS ---
// --- TOP 10 LOWEST PROFIT SALES ITEMS ---
const lowProfitSalesItems = await Sale.aggregate([
  // 1. Match sales within the date range and exclude 'Reversed' status
  { $match: { invoice_date: { $gte: start, $lte: end }, status: { $ne: "Reversed" } } },
  
  // 2. Deconstruct the items array
  { $unwind: "$items" }, 
  
  // 3. Project necessary sale item fields
  { $project: {
      item_id: "$items.item_id",
      itemName: "$items.itemName",
      sellingPrice: "$items.price", // Use unit price as revenue
      quantity: "$items.quantity",
      isSerialized: "$items.isSerialized",
      serialNumbers: "$items.serialNumbers",
      batch_number: "$items.batch_number"
  } },

  // 4. Look up the Unit Cost from the 'purchases' collection
  { $lookup: {
      from: "purchases", // Name of your Purchase collection
      let: { 
          item_id: "$item_id", 
          is_serialized: "$isSerialized", 
          serials: "$serialNumbers", 
          batch: "$batch_number" 
      },
      pipeline: [
          // Match by item_id
          { $match: { $expr: { $eq: ["$purchasedItems.item_id", "$$item_id"] } } },
          { $unwind: "$purchasedItems" },
          { $match: { $expr: { $eq: ["$purchasedItems.item_id", "$$item_id"] } } },
          
          // Logic for matching batch or serials
          { $project: {
              unitCost: "$purchasedItems.unitCost",
              isMatch: {
                  $cond: {
                      if: "$$is_serialized",
                      then: { $setIsSubset: ["$$serials", "$purchasedItems.serializedItems"] },
                      else: { $eq: ["$purchasedItems.batch_number", "$$batch"] }
                  }
              }
          } },
          { $match: { isMatch: true } },
          { $limit: 1 },
          { $project: { _id: 0, unitCost: 1 } }
      ],
      as: "costData"
  } },

  // 5. Extract the unitCost and calculate Total Profit for the item
  { $addFields: {
      unitCost: { $ifNull: [{ $arrayElemAt: ["$costData.unitCost", 0] }, 0] },
      totalProfit: { 
          $multiply: [
              { $subtract: ["$sellingPrice", { $ifNull: [{ $arrayElemAt: ["$costData.unitCost", 0] }, 0] }] }, 
              "$quantity"
          ] 
      }
  } },
  
  // 6. Group by item_id to aggregate the total profit
  { $group: {
      _id: "$item_id",
      itemName: { $first: "$itemName" },
      // Use the newly calculated totalProfit
      totalAggregatedProfit: { $sum: "$totalProfit" } 
  } },
  
  // 7. Sort by lowest profit (ascending: 1) and Limit
  { $sort: { totalAggregatedProfit: 1 } },
  { $limit: 10 }
]);

// --- MONTHLY PURCHASE, SALES, PROFIT TREND FOR CHARTS ---
// --- A. MONTHLY SALES AND PROFIT AGGREGATION ---
const monthlyFinancialTrend  = await Sale.aggregate([
  { $match: { 
      invoice_date: { $gte: new Date(new Date().getFullYear(), 0, 1), $lte: end }, 
      status: { $ne: "Reversed" } 
  } },
  
  // 1. Unwind items and look up the unit cost (same lookup logic as before)
  { $unwind: "$items" },
  { $project: {
      month: { $month: "$invoice_date" },
      year: { $year: "$invoice_date" },
      sellingPrice: "$items.price", 
      quantity: "$items.quantity",
      item_id: "$items.item_id",
      isSerialized: "$items.isSerialized",
      serialNumbers: "$items.serialNumbers",
      batch_number: "$items.batch_number"
  } },

  // 2. Look up Unit Cost from Purchases (using a simplified version for aggregation)
  // NOTE: You must decide if you want to perform this expensive lookup for every item
  // OR if you should pre-calculate COGS on the Sale document at the time of sale.
  // For now, we use the lookup method for accuracy.
  { $lookup: {
      from: "purchases",
      let: { 
          item_id: "$item_id", 
          is_serialized: "$isSerialized", 
          serials: "$serialNumbers", 
          batch: "$batch_number" 
      },
      pipeline: [
          // (Same cost-finding logic as in previous query, shortened for brevity)
          // ...
          { $match: { $expr: { $eq: ["$purchasedItems.item_id", "$$item_id"] } } },
          { $unwind: "$purchasedItems" },
          { $match: { $expr: { $eq: ["$purchasedItems.item_id", "$$item_id"] } } },
          { $project: {
              unitCost: "$purchasedItems.unitCost",
              isMatch: { $cond: { if: "$$is_serialized", then: { $setIsSubset: ["$$serials", "$purchasedItems.serializedItems"] }, else: { $eq: ["$purchasedItems.batch_number", "$$batch"] } } }
          } },
          { $match: { isMatch: true } },
          { $limit: 1 },
          { $project: { _id: 0, unitCost: 1 } }
      ],
      as: "costData"
  } },
  
  // 3. Calculate COGS for the item (Cost * Quantity)
  { $addFields: {
      unitCost: { $ifNull: [{ $arrayElemAt: ["$costData.unitCost", 0] }, 0] },
      cogs: { $multiply: [{ $ifNull: [{ $arrayElemAt: ["$costData.unitCost", 0] }, 0] }, "$quantity"] },
      revenue: { $multiply: ["$sellingPrice", "$quantity"] }
  } },

  // 4. Group by Month and Year
  { $group: {
      _id: { year: "$year", month: "$month" },
      salesAmount: { $sum: "$revenue" },
      salesCost: { $sum: "$cogs" },
      // Profit calculated here as Sales - COGS
      profit: { $sum: { $subtract: ["$revenue", "$cogs"] } }
  }},

  // 5. Sort the results
  { $sort: { "_id.year": 1, "_id.month": 1 } }
]);

 const purchaseTrend = await Purchase.aggregate([
      { $match: { purchaseDate: { $gte: start, $lte: end } } },
      { $unwind: "$purchasedItems" },
      { $project: {
          month: { $month: "$purchaseDate" },
          year: { $year: "$purchaseDate" },
          totalPurchase: "$purchasedItems.total_price"
      }},
      { $group: {
          _id: { month: "$month", year: "$year" },
          totalPurchaseAmount: { $sum: "$totalPurchase" }
      }},
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    // --- 5. Helper to calculate growth ---
    


  // --- 5. Helper to calculate growth ---
   

    //const salesTrendWithGrowth = calculateGrowth(salesProfitTrend, "totalSales");
   // const profitTrendWithGrowth = calculateGrowth(salesProfitTrend, "totalProfit");
   // const purchaseTrendWithGrowth = calculateGrowth(purchaseTrend, "totalPurchaseAmount");


    // --- PAYLOAD ---
    const payload = {
      range,
      // salesTrend: salesTrendWithGrowth,
     // profitTrend: profitTrendWithGrowth,
    //  purchaseTrend: purchaseTrendWithGrowth,
      topProfitSalesItems,
      lowProfitSalesItems,
      monthlyFinancialTrend,
      sales: {...sales, salesGrowth, profitGrowth },
      dailySalesTrend,
      monthlySalesTrend,
      purchases,
      monthlyPurchaseTrend,
      transactions,
      repairs,
      customers: { totalCustomers, newCustomersThisPeriod, topCustomers },
      inventory: { lowStockCount, serializedAvailable },
      generatedAt: new Date()
    };

    if (redisClient) await redisClient.setex(cacheKey, 90, JSON.stringify(payload));

    res.json(payload);

  } catch (err) {
    console.error("Dashboard V2 error:", err);
    res.status(500).json({ message:"Dashboard V2 failed", error: err.message });
  }
};
