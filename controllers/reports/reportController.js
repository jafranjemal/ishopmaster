const SalesInvoice = require('../../models/SalesInvoice');
const Ticket = require('../../models/Ticket');
const StockLedger = require('../../models/StockLedger');
const Customer = require('../../models/Customer');
const Supplier = require('../../models/Supplier');
const asyncHandler = require('express-async-handler');

/**
 * @desc    Owner Intelligence Dash - Strategic Flash
 * @route   GET /api/reports/owner-flash
 */
exports.getOwnerFlash = asyncHandler(async (req, res) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [customers, suppliers, salesToday, salesMonth, purchasesToday, purchasesMonth] = await Promise.all([
        Customer.countDocuments(),
        Supplier.countDocuments(),
        SalesInvoice.aggregate([
            { $match: { createdAt: { $gte: startOfToday } } },
            { $group: { _id: null, total: { $sum: "$total_amount" } } }
        ]),
        SalesInvoice.aggregate([
            { $match: { createdAt: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: "$total_amount" } } }
        ]),
        StockLedger.aggregate([
            { $match: { createdAt: { $gte: startOfToday }, movementType: "Purchase-In" } },
            { $group: { _id: null, total: { $sum: { $abs: "$qty" } } } } // Simplifying to qty for flash or totalCost if available
        ]),
        StockLedger.aggregate([
            { $match: { createdAt: { $gte: startOfToday }, movementType: "Purchase-In" } },
            { $group: { _id: null, total: { $sum: { $abs: "$qty" } } } }
        ])
    ]);

    res.json({
        activeCustomers: customers,
        activeSuppliers: suppliers,
        salesTotal: salesMonth[0]?.total || 0,
        dailySales: salesToday[0]?.total || 0,
        purchasesTotal: purchasesMonth[0]?.total || 0,
        healthIndicator: (salesMonth[0]?.total || 0) >= (purchasesMonth[0]?.total || 0) ? 'Stable' : 'Aggressive Sourcing'
    });
});

/**
 * @desc    Customer Behavior & Credit Risk
 */
exports.getCustomerIntelligence = asyncHandler(async (req, res) => {
    const data = await Customer.aggregate([
        {
            $lookup: {
                from: 'salesinvoices',
                localField: '_id',
                foreignField: 'customer', // Fixed from customerId
                as: 'invoices'
            }
        },
        {
            $project: {
                first_name: 1, last_name: 1, phone_number: 1, creditLimit: 1, currentBalance: 1,
                totalRevenue: { $sum: "$invoices.total_amount" },
                visitCount: { $size: "$invoices" },
                lastVisit: { $max: "$invoices.createdAt" }
            }
        },
        { $sort: { totalRevenue: -1 } }
    ]);
    res.json(data);
});

/**
 * @desc    Supplier Exposure & Reliability (Strategic procurement audit)
 */
exports.getSupplierIntelligence = asyncHandler(async (req, res) => {
    const Purchase = require('../../models/Purchase');
    const data = await Supplier.aggregate([
        {
            $lookup: {
                from: 'purchases',
                localField: '_id',
                foreignField: 'supplier',
                as: 'purchases'
            }
        },
        {
            $project: {
                name: 1, contact_person: 1, phone: 1, creditLimit: 1, currentBalance: 1,
                totalPurchased: { $sum: "$purchases.grand_total" },
                purchaseCount: { $size: "$purchases" }
            }
        },
        { $sort: { totalPurchased: -1 } }
    ]);
    res.json(data);
});

/**
 * @desc    Stock Valuation & Condition Matrix (Forensic Audit)
 */
exports.getStockValuation = asyncHandler(async (req, res) => {
    const SerializedStock = require('../../models/SerializedStock');
    const NonSerializedStock = require('../../models/NonSerializedStock');

    const [serialized, nonSerialized] = await Promise.all([
        SerializedStock.aggregate([
            { $match: { status: "Available" } },
            {
                $group: {
                    _id: "$condition",
                    count: { $sum: 1 },
                    valuation: { $sum: "$unitCost" }
                }
            }
        ]),
        NonSerializedStock.aggregate([
            { $match: { availableQty: { $gt: 0 } } },
            {
                $group: {
                    _id: "$condition",
                    count: { $sum: "$availableQty" },
                    valuation: { $sum: { $multiply: ["$availableQty", "$unitCost"] } }
                }
            }
        ])
    ]);

    // Merge results
    const combined = {};
    [...serialized, ...nonSerialized].forEach(item => {
        if (!combined[item._id]) combined[item._id] = { condition: item._id, count: 0, valuation: 0 };
        combined[item._id].count += item.count;
        combined[item._id].valuation += item.valuation;
    });

    res.json(Object.values(combined).sort((a, b) => b.valuation - a.valuation));
});

/**
 * @desc    Trend-based Forecasting (Predictive Intelligence)
 */
exports.getForecasting = asyncHandler(async (req, res) => {
    const data = await SalesInvoice.aggregate([
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                total: { $sum: "$total_amount" },
                count: { $sum: 1 }
            }
        },
        { $sort: { "_id": -1 } },
        { $limit: 6 }
    ]);

    // Basic prediction logic
    const historical = data.reverse();
    const growthRates = [];
    for (let i = 1; i < historical.length; i++) {
        const rate = (historical[i].total - historical[i - 1].total) / (historical[i - 1].total || 1);
        growthRates.push(rate);
    }

    const avgGrowth = growthRates.length > 0 ? growthRates.reduce((a, b) => a + b, 0) / growthRates.length : 0;
    const lastMonth = historical[historical.length - 1]?.total || 0;

    res.json({
        historical,
        forecastNextMonth: lastMonth * (1 + avgGrowth),
        confidenceScore: historical.length >= 3 ? 0.85 : 0.45,
        growthRate: (avgGrowth * 100).toFixed(2)
    });
});

/**
 * @desc    Service (Labor) vs Retail (Hardware) profit split
 */
exports.getServiceVsRetail = asyncHandler(async (req, res) => {
    const data = await SalesInvoice.aggregate([
        { $unwind: "$items" },
        {
            $group: {
                _id: "$items.isSerialized", // Using isSerialized as a proxy for Hardware vs Service if itemType is missing
                revenue: { $sum: "$items.totalPrice" },
                count: { $sum: 1 }
            }
        }
    ]);
    res.json(data);
});

/**
 * @desc    Standard Profit & Loss (P&L) trends
 */
exports.getProfitLoss = asyncHandler(async (req, res) => {
    const data = await SalesInvoice.aggregate([
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                revenue: { $sum: "$total_amount" },
                expenses: { $sum: 0 }
            }
        },
        { $sort: { "_id": 1 } }
    ]);
    res.json(data);
});

/**
 * @desc    Comprehensive Business Audit [World-Class Diagnostic]
 * @route   GET /api/reports/comprehensive-audit
 */
exports.getComprehensiveAudit = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    const Company = require('../../models/Company');
    const Expense = require('../../models/Expense');
    const SerializedStock = require('../../models/SerializedStock');
    const NonSerializedStock = require('../../models/NonSerializedStock');
    const Customer = require('../../models/Customer');
    const Supplier = require('../../models/Supplier');
    const Account = require('../../models/Account');

    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date();

    // Set hours to cover full day
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const [company, salesData, expenseData, arData, apData, stockValue, deadStockList] = await Promise.all([
        Company.findOne(),
        SalesInvoice.aggregate([
            { $match: { createdAt: { $gte: start, $lte: end } } },
            {
                $group: {
                    _id: null,
                    grossSales: {
                        $sum: { $cond: [{ $eq: ["$transaction_type", "Sale"] }, "$total_amount", 0] }
                    },
                    returns: {
                        $sum: { $cond: [{ $eq: ["$transaction_type", "Return"] }, "$total_amount", 0] }
                    },
                    count: { $sum: 1 },
                    // Extract items for manual COGS loop
                    soldItems: { $push: "$items" }
                }
            }
        ]),
        Expense.aggregate([
            { $match: { date: { $gte: start, $lte: end } } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]),
        Account.aggregate([
            { $match: { account_owner_type: "Customer" } },
            { $group: { _id: null, total: { $sum: "$balance" } } }
        ]),
        Account.aggregate([
            { $match: { account_owner_type: "Supplier" } },
            { $group: { _id: null, total: { $sum: "$balance" } } }
        ]),
        exports.getValuationLogic(),
        // Dead Stock Details: Top 20 items stuck for 60+ days
        SerializedStock.find({
            status: "Available",
            createdAt: { $lt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) }
        }).populate('item_id', 'itemName').select('item_id unitCost createdAt').limit(20).lean()
    ]);

    const revData = salesData[0] || { grossSales: 0, returns: 0, count: 0, soldItems: [] };
    const revenue = revData.grossSales - revData.returns;

    // ACCURATE COGS CALCULATION (Purchase Linked)
    let totalRealCogs = 0;
    const Purchase = require('../../models/Purchase');

    // Flatten and unique sold items
    const flattenedSales = [].concat(...revData.soldItems);
    for (const item of flattenedSales) {
        // Priority: Variant matches, else Item matches
        const costQuery = item.variant_id
            ? { "purchasedItems.variant_id": item.variant_id }
            : { "purchasedItems.item_id": item.item_id };

        const latestPurchase = await Purchase.findOne(costQuery)
            .sort({ purchaseDate: -1 })
            .select({ purchasedItems: { $elemMatch: item.variant_id ? { variant_id: item.variant_id } : { item_id: item.item_id } } });

        const unitCost = latestPurchase?.purchasedItems[0]?.unitCost || item.unitCost || 0;
        totalRealCogs += (unitCost * (item.quantity || 1));
    }

    let cogsValue = totalRealCogs;
    let isCogsEstimated = false;
    if (revenue > 0 && cogsValue === 0) {
        cogsValue = revenue * 0.75; // Industry fallback if no purchase history
        isCogsEstimated = true;
    }

    const grossProfit = revenue - cogsValue;
    let burnRate = expenseData[0]?.total || 0;
    let isExpenseEstimated = false;
    if (revenue > 0 && burnRate === 0) {
        burnRate = revenue * 0.15;
        isExpenseEstimated = true;
    }

    const netProfit = grossProfit - burnRate;
    const receivable = arData[0]?.total || 0;
    const payable = apData[0]?.total || 0;

    // Strategy Engine
    let strategyMessage = "Your business is currently in a steady state. ";
    if (netProfit < 0) strategyMessage = "CRITICAL: Current data indicates you are running a real deficit. Sourcing costs (COGS) and overheads are higher than sales volume.";
    else if (revenue > 200000) strategyMessage = "EXCELLENT: High volume detected. Ensure your inventory rotation matches this velocity to avoid cash-traps.";

    res.json({
        period: { start, end },
        company,
        data_integrity: {
            cogs_verified: !isCogsEstimated,
            expenses_verified: !isExpenseEstimated
        },
        performance: {
            revenue,
            cogs: cogsValue,
            grossProfit,
            salesCount: revData.count,
            expenses: burnRate,
            netProfit,
            profitMargin: revenue > 0 ? ((netProfit / revenue) * 100).toFixed(2) : 0
        },
        liabilities: {
            receivable,
            payable,
            riskRatio: payable / (receivable || 1)
        },
        assets: {
            stockValue,
            deadStockCount: deadStockList.length,
            deadStockValue: deadStockList.reduce((sum, item) => sum + (item.unitCost || 0), 0),
            deadStockDetails: deadStockList,
            health: deadStockList.length > 5 ? 'At Risk (Frozen Capital)' : 'Healthy Velocity'
        },
        strategy: strategyMessage,
        version: "1.0.21"
    });
});

// Helper for unified valuation logic
exports.getValuationLogic = async () => {
    const SerializedStock = require('../../models/SerializedStock');
    const NonSerializedStock = require('../../models/NonSerializedStock');
    const [ser, non] = await Promise.all([
        SerializedStock.aggregate([{ $match: { status: "Available" } }, { $group: { _id: null, val: { $sum: "$unitCost" } } }]),
        NonSerializedStock.aggregate([{ $match: { availableQty: { $gt: 0 } } }, { $group: { _id: null, val: { $sum: { $multiply: ["$availableQty", "$unitCost"] } } } }])
    ]);
    return (ser[0]?.val || 0) + (non[0]?.val || 0);
};
