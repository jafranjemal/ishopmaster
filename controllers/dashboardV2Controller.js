// controllers/dashboardV2Controller.js
const mongoose = require("mongoose");
const Purchase = require("../models/Purchase");
const Sale = require("../models/SalesInvoice");
const SerializedStock = require("../models/SerializedStock");
const NonSerializedStock = require("../models/NonSerializedStock");
const Transaction = require("../models/Transaction");
const Repair = require("../models/RepairOrder");
const Customer = require("../models/Customer");
const Payment = require("../models/Payment");
const redisClient = require("../lib/redis");


// --- Helper: parse time ranges ---
const parseRange = (range = "today") => {
  const now = new Date();
  let start;
  switch (range) {
    case "today":
      start = new Date(now.setHours(0, 0, 0, 0)); break;
    case "week":
      start = new Date(now); start.setDate(now.getDate() - 6); start.setHours(0, 0, 0, 0); break;
    case "month":
      start = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case "year":
      start = new Date(now.getFullYear(), 0, 1); break;
    default:
      start = new Date(0);
  }
  return { start, end: new Date() };
};

// --- Helper: group by date ---
const dateGroup = (field, period = "daily") => {
  if (period === "daily") return { year: { $year: `$${field}` }, month: { $month: `$${field}` }, day: { $dayOfMonth: `$${field}` } };
  if (period === "monthly") return { year: { $year: `$${field}` }, month: { $month: `$${field}` } };
};

// --- Helper: calculate growth ---
const calculateGrowth = (current, previous) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

// --- TREND AGGREGATIONS ---
async function getTrends(start, end) {
  const dailySalesTrend = await Sale.aggregate([
    { $match: { invoice_date: { $gte: start, $lte: end }, status: { $ne: "Reversed" } } },
    {
      $group: {
        _id: dateGroup("invoice_date", "daily"),
        salesAmount: { $sum: "$total_amount" },
        profit: { $sum: { $subtract: ["$total_amount", "$total_paid_amount"] } } // Placeholder, real profit needs COGS lookup if required for trend
      }
    },
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
  ]);

  const monthlyFinancialTrend = await Sale.aggregate([
    { $match: { invoice_date: { $gte: new Date(new Date().getFullYear(), 0, 1), $lte: end }, status: { $ne: "Reversed" } } },
    {
      $group: {
        _id: dateGroup("invoice_date", "monthly"),
        salesAmount: { $sum: "$total_amount" },
        profit: { $sum: { $subtract: ["$total_amount", "$total_paid_amount"] } }
      }
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } }
  ]);

  return { dailySalesTrend, monthlyFinancialTrend };
}

// --- SALES AGGREGATION ---
async function getSalesData(start, end) {
  const salesAgg = await Sale.aggregate([
    { $match: { invoice_date: { $gte: start, $lte: end }, status: { $ne: "Reversed" } } },
    {
      $facet: {
        summaryByItem: [
          { $unwind: "$items" },
          {
            $project: {
              orderId: "$_id",
              totalSaleAmount: "$total_amount",
              totalPaidAmount: "$total_paid_amount",
              item_id: "$items.item_id",
              itemSellingPrice: "$items.price",
              quantity: "$items.quantity",
              isSerialized: "$items.isSerialized",
              serialNumbers: "$items.serialNumbers",
              batch_number: "$items.batch_number"
            }
          },
          {
            $lookup: {
              from: "purchases",
              let: { item_id: "$item_id", is_serialized: "$isSerialized", serials: "$serialNumbers", batch: "$batch_number" },
              pipeline: [
                { $unwind: "$purchasedItems" },
                { $match: { $expr: { $eq: ["$purchasedItems.item_id", "$$item_id"] } } },
                {
                  $project: {
                    unitCost: "$purchasedItems.unitCost",
                    isMatch: {
                      $cond: {
                        if: "$$is_serialized",
                        then: { $gt: [{ $size: { $setIntersection: ["$$serials", "$purchasedItems.serializedItems"] } }, 0] },
                        else: { $eq: ["$purchasedItems.batch_number", "$$batch"] }
                      }
                    }
                  }
                },
                { $match: { isMatch: true } },
                { $limit: 1 },
                { $project: { _id: 0, unitCost: 1 } }
              ],
              as: "costData"
            }
          },
          {
            $addFields: {
              unitCost: { $ifNull: [{ $arrayElemAt: ["$costData.unitCost", 0] }, 0] },
              itemCOGS: { $multiply: ["$quantity", { $ifNull: [{ $arrayElemAt: ["$costData.unitCost", 0] }, 0] }] }
            }
          },
          {
            $group: {
              _id: "$orderId",
              totalSales: { $first: "$totalSaleAmount" },
              totalPaid: { $first: "$totalPaidAmount" },
              totalCostPerOrder: { $sum: "$itemCOGS" },
              maxSale: { $first: "$totalSaleAmount" },
              minSale: { $first: "$totalSaleAmount" }
            }
          },
          {
            $group: {
              _id: null,
              totalSales: { $sum: "$totalSales" },
              totalCost: { $sum: "$totalCostPerOrder" },
              totalPaid: { $sum: "$totalPaid" },
              orders: { $sum: 1 },
              netProfit: { $sum: { $subtract: ["$totalSales", "$totalCostPerOrder"] } },
              maxSale: { $max: "$maxSale" },
              minSale: { $min: "$minSale" }
            }
          }
        ],
        breakdown: [
          {
            $group: {
              _id: "$invoice_type",
              value: { $sum: "$total_amount" }
            }
          }
        ],
        byCategory: [
          { $unwind: "$items" },
          {
            $lookup: {
              from: "items",
              localField: "items.item_id",
              foreignField: "_id",
              as: "itemInfo"
            }
          },
          { $unwind: "$itemInfo" },
          {
            $group: {
              _id: "$itemInfo.category",
              value: { $sum: "$items.totalPrice" }
            }
          },
          { $sort: { value: -1 } }
        ],
        byBrand: [
          { $unwind: "$items" },
          {
            $lookup: {
              from: "items",
              localField: "items.item_id",
              foreignField: "_id",
              as: "itemInfo"
            }
          },
          { $unwind: "$itemInfo" },
          {
            $lookup: {
              from: "brands",
              localField: "itemInfo.brand",
              foreignField: "_id",
              as: "brandInfo"
            }
          },
          { $unwind: { path: "$brandInfo", preserveNullAndEmptyArrays: true } },
          {
            $group: {
              _id: { $ifNull: ["$brandInfo.name", "Generic"] },
              value: { $sum: "$items.totalPrice" }
            }
          },
          { $sort: { value: -1 } }
        ]
      }
    }
  ]);

  const summary = salesAgg[0].summaryByItem[0] || { totalSales: 0, totalCost: 0, totalPaid: 0, orders: 0, netProfit: 0, maxSale: 0, minSale: 0 };
  const breakdown = salesAgg[0].breakdown || [];
  const byCategory = salesAgg[0].byCategory || [];
  const byBrand = salesAgg[0].byBrand || [];

  return { ...summary, breakdown, byCategory, byBrand };
}

// --- REPAIRS ---
async function getRepairData(start, end) {
  const repairAgg = await Repair.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: null,
        completed: { $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $in: ["$status", ["Received", "InProgress", "AwaitingParts"]] }, 1, 0] } },
        total: { $sum: 1 },
        avgDurationMins: { $avg: "$durationMinutes" }
      }
    }
  ]);
  const data = repairAgg[0] || { completed: 0, pending: 0, total: 0, avgDurationMins: 0 };
  data.successRate = data.total > 0 ? ((data.completed / data.total) * 100).toFixed(1) : 0;
  return data;
}

// --- PURCHASES ---
async function getPurchaseData(start, end) {
  const purchaseAgg = await Purchase.aggregate([
    { $match: { purchaseDate: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: null,
        totalPurchaseAmount: { $sum: "$grand_total" },
        totalItemsPurchased: { $sum: "$total_items_count" },
        purchaseCount: { $sum: 1 },
        totalPaidToSuppliers: { $sum: { $subtract: ["$grand_total", "$payment_due_amount"] } },
        totalPurchaseDue: { $sum: "$payment_due_amount" }
      }
    }
  ]);
  return purchaseAgg[0] || { totalPurchaseAmount: 0, totalItemsPurchased: 0, purchaseCount: 0, totalPaidToSuppliers: 0, totalPurchaseDue: 0 };
}

async function getInventoryData() {
  const lowNonSerialized = await NonSerializedStock.aggregate([
    { $group: { _id: "$item_id", totalAvailable: { $sum: "$availableQty" } } },
    { $lookup: { from: "items", localField: "_id", foreignField: "_id", as: "item" } },
    { $unwind: { path: "$item", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        numAlertQty: {
          $convert: {
            input: "$item.alertQuantity",
            to: "double",
            onError: 0,
            onNull: 0
          }
        }
      }
    },
    {
      $match: {
        $expr: {
          $and: [
            { $gt: ["$numAlertQty", 0] },
            { $lte: ["$totalAvailable", "$numAlertQty"] }
          ]
        }
      }
    },
    {
      $project: {
        item_id: "$_id",
        itemName: "$item.itemName",
        category: "$item.category",
        serialized: "$item.serialized",
        totalAvailable: 1,
        alertQty: "$numAlertQty"
      }
    }
  ]);

  const lowSerialized = await SerializedStock.aggregate([
    { $match: { status: "Available" } },
    { $group: { _id: "$item_id", totalAvailable: { $sum: 1 } } },
    { $lookup: { from: "items", localField: "_id", foreignField: "_id", as: "item" } },
    { $unwind: { path: "$item", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        numAlertQty: {
          $convert: {
            input: "$item.alertQuantity",
            to: "double",
            onError: 0,
            onNull: 0
          }
        }
      }
    },
    {
      $match: {
        $expr: {
          $and: [
            { $gt: ["$numAlertQty", 0] },
            { $lte: ["$totalAvailable", "$numAlertQty"] }
          ]
        }
      }
    },
    {
      $project: {
        item_id: "$_id",
        itemName: "$item.itemName",
        category: "$item.category",
        serialized: "$item.serialized",
        totalAvailable: 1,
        alertQty: "$numAlertQty"
      }
    }
  ]);

  const allLowStock = [...lowNonSerialized, ...lowSerialized];
  const inventory = allLowStock.map(s => ({
    item_id: s.item_id,
    itemName: s.itemName,
    category: s.category,
    serialized: s.serialized,
    totalAvailable: s.totalAvailable,
    alertQty: s.alertQty,
    message: `${s.itemName} is low on stock (${s.totalAvailable} left)`
  }))

  return { alerts: inventory, lowStockCount: allLowStock.length };
}


// --- CUSTOMERS ---
async function getCustomerData(start, end) {
  const totalCustomers = await Customer.countDocuments({});
  const newCustomersThisPeriod = await Customer.countDocuments({ created_at: { $gte: start, $lte: end } });
  const topCustomers = await Sale.aggregate([
    { $match: { invoice_date: { $gte: start, $lte: end }, status: { $ne: "Reversed" } } },
    { $group: { _id: "$customer", totalPurchase: { $sum: "$total_amount" } } },
    { $sort: { totalPurchase: -1 } },
    { $limit: 10 },
    { $lookup: { from: "customers", localField: "_id", foreignField: "_id", as: "customer" } },
    { $unwind: "$customer" },
    { $project: { _id: 0, customerName: "$customer.first_name", totalPurchase: 1 } }
  ]);
  return { totalCustomers, newCustomersThisPeriod, topCustomers };
}

// --- Finance Data  ---

async function getFinanceData(start, end) {
  // --- AR Aging (Receivables >30 days overdue) ---
  const arInvoices = await Sale.aggregate([
    { $match: { status: { $in: ["Unpaid", "Partially paid"] } } },
    {
      $project: {
        overdueDays: { $divide: [{ $subtract: [new Date(), "$invoice_date"] }, 1000 * 60 * 60 * 24] },
        balance: { $subtract: ["$total_amount", "$total_paid_amount"] }
      }
    },
    { $match: { overdueDays: { $gt: 30 }, balance: { $gt: 0 } } },
    { $group: { _id: null, arAging: { $sum: "$balance" } } }
  ]);

  // --- AP Aging (Payables >15 days overdue) ---
  const apInvoices = await Purchase.aggregate([
    { $match: { purchase_status: { $ne: "Cancelled" }, payment_status: { $in: ["Not Paid", "Partial"] } } },
    {
      $project: {
        overdueDays: { $divide: [{ $subtract: [new Date(), "$purchaseDate"] }, 1000 * 60 * 60 * 24] },
        balance: "$payment_due_amount"
      }
    },
    { $match: { overdueDays: { $gt: 15 }, balance: { $gt: 0 } } },
    { $group: { _id: null, apAging: { $sum: "$balance" } } }
  ]);

  // --- Detailed Transactional Flow (Deposits & Withdrawals) ---
  const flowStats = await Transaction.aggregate([
    { $match: { transaction_date: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: null,
        totalDeposits: { $sum: { $cond: [{ $eq: ["$transaction_type", "Deposit"] }, "$amount", 0] } },
        depositCount: { $sum: { $cond: [{ $eq: ["$transaction_type", "Deposit"] }, 1, 0] } },
        totalWithdrawals: { $sum: { $cond: [{ $eq: ["$transaction_type", "Withdrawal"] }, "$amount", 0] } },
        withdrawalCount: { $sum: { $cond: [{ $eq: ["$transaction_type", "Withdrawal"] }, 1, 0] } }
      }
    }
  ]);

  const finance = flowStats[0] || { totalDeposits: 0, depositCount: 0, totalWithdrawals: 0, withdrawalCount: 0 };
  finance.netCashFlow = finance.totalDeposits - finance.totalWithdrawals;

  // --- Operational Profit (Simplified) ---
  // In a real scenario, this would be netProfit from sales minus general expenses
  // For now we'll ensure ebitdaTrend is returned to the frontend

  return {
    ...finance,
    arAging: arInvoices[0]?.arAging || 0,
    apAging: apInvoices[0]?.apAging || 0,
    ebitdaTrend: 0 // Will be populated in overview from sales data
  };
}

async function getTopProducts(start, end) {
  return await Sale.aggregate([
    { $match: { invoice_date: { $gte: start, $lte: end }, status: { $ne: "Reversed" } } },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.item_id",
        soldQty: { $sum: "$items.quantity" },
        revenue: { $sum: "$items.totalPrice" }
      }
    },
    { $sort: { revenue: -1 } },
    { $limit: 10 },
    { $lookup: { from: "items", localField: "_id", foreignField: "_id", as: "item" } },
    { $unwind: "$item" },
    {
      $project: {
        itemName: "$item.itemName",
        sku: "$item.sku",
        soldQty: 1,
        revenue: 1
      }
    }
  ]);
}

// --- MAIN DASHBOARD CONTROLLER ---
exports.overview = async (req, res) => {
  try {
    const { range = "all" } = req.query;
    const { start, end } = parseRange(range);

    // Redis cache
    const cacheKey = `dashboard:v2:${range}`;
    if (redisClient) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return res.json(JSON.parse(cached));
    }

    // Previous Period for Growth
    const prevStart = new Date(start);
    const prevEnd = new Date(start);
    if (range === "month") prevStart.setMonth(prevStart.getMonth() - 1);
    else if (range === "week") prevStart.setDate(prevStart.getDate() - 7);
    else if (range === "year") prevStart.setFullYear(prevStart.getFullYear() - 1);
    else prevStart.setDate(prevStart.getDate() - 1);

    const [sales, repairs, purchases, inventory, customers, finance, prevSales, trends, topProducts] = await Promise.all([
      getSalesData(start, end),
      getRepairData(start, end),
      getPurchaseData(start, end),
      getInventoryData(),
      getCustomerData(start, end),
      getFinanceData(start, end),
      getSalesData(prevStart, prevEnd),
      getTrends(start, end),
      getTopProducts(start, end)
    ]);

    // Calculate Growth
    sales.salesGrowth = calculateGrowth(sales.totalSales, prevSales.totalSales);
    sales.profitGrowth = calculateGrowth(sales.netProfit, prevSales.netProfit);
    finance.ebitdaTrend = sales.netProfit; // Sync Sales Net Profit as Operational Profit

    // Payload
    const payload = {
      range,
      sales,
      repairs,
      purchases,
      inventory,
      customers,
      finance,
      trends,
      topProducts,
      generatedAt: new Date()
    };

    if (redisClient) await redisClient.setex(cacheKey, 90, JSON.stringify(payload));
    res.json(payload);
  } catch (err) {
    console.error("Dashboard V2 error:", err);
    res.status(500).json({ message: "Dashboard V2 failed", error: err.message });
  }
};
