const SalesInvoice = require('../../models/SalesInvoice');
const Ticket = require('../../models/Ticket');
const StockLedger = require('../../models/StockLedger');
const Customer = require('../../models/Customer');
const Supplier = require('../../models/Supplier');
const asyncHandler = require('express-async-handler');

/**
 * @desc    Owner Intelligence Dash - Big Picture
 * @route   GET /api/reports/owner-flash
 */
exports.getOwnerFlash = asyncHandler(async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [customers, suppliers, sales, purchases] = await Promise.all([
        Customer.countDocuments({ createdAt: { $gte: today } }),
        Supplier.countDocuments({ createdAt: { $gte: today } }),
        SalesInvoice.aggregate([
            { $match: { createdAt: { $gte: today } } },
            { $group: { _id: null, total: { $sum: "$grandTotal" } } }
        ]),
        // Assuming a Purchase model exists or linked to StockLedger
        StockLedger.aggregate([
            { $match: { createdAt: { $gte: today }, movementType: "Purchase-In" } },
            { $group: { _id: null, total: { $sum: { $multiply: ["$qty", "$unitCost"] } } } }
        ])
    ]);

    res.json({
        activeCustomers: customers,
        activeSuppliers: suppliers,
        salesTotal: sales[0]?.total || 0,
        purchasesTotal: purchases[0]?.total || 0,
        healthIndicator: sales[0]?.total > purchases[0]?.total ? 'Stable' : 'High Outflow'
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
                foreignField: 'customerId',
                as: 'invoices'
            }
        },
        {
            $project: {
                first_name: 1, last_name: 1, phone_number: 1, creditLimit: 1, currentBalance: 1,
                totalRevenue: { $sum: "$invoices.grandTotal" },
                visitCount: { $size: "$invoices" },
                lastVisit: { $max: "$invoices.createdAt" }
            }
        },
        { $sort: { totalRevenue: -1 } }
    ]);
    res.json(data);
});

/**
 * @desc    Supplier Exposure & Reliability
 */
exports.getSupplierIntelligence = asyncHandler(async (req, res) => {
    const data = await Supplier.aggregate([
        {
            $lookup: {
                from: 'stockledgers',
                localField: '_id',
                foreignField: 'supplier_id',
                as: 'movements'
            }
        },
        {
            $project: {
                name: 1, contact_person: 1, phone: 1, creditLimit: 1, currentBalance: 1,
                totalPurchased: { $sum: { $map: { input: "$movements", as: "m", in: { $multiply: ["$$m.qty", "$$m.unitCost"] } } } },
                avgPriceVariance: { $avg: "$movements.priceVariance" }
            }
        }
    ]);
    res.json(data);
});

/**
 * @desc    Stock Valuation & Condition Matrix
 */
exports.getStockValuation = asyncHandler(async (req, res) => {
    const data = await StockLedger.aggregate([
        { $match: { qty: { $gt: 0 } } },
        {
            $group: {
                _id: { category: "$category", condition: "$condition" },
                totalQty: { $sum: "$qty" },
                totalValue: { $sum: { $multiply: ["$qty", "$unitCost"] } }
            }
        },
        { $sort: { totalValue: -1 } }
    ]);
    res.json(data);
});

/**
 * @desc    Service (Labor) vs Retail (Hardware) profit split
 */
exports.getServiceVsRetail = asyncHandler(async (req, res) => {
    const data = await SalesInvoice.aggregate([
        { $unwind: "$items" },
        {
            $group: {
                _id: "$items.itemType",
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
                revenue: { $sum: "$grandTotal" },
                expenses: { $sum: "$totalCost" || 0 } // Assuming totalCost is stored or calculated
            }
        },
        { $sort: { "_id": 1 } }
    ]);
    res.json(data);
});

/**
 * @desc    Trend-based Forecasting (Fast Forward)
 */
exports.getForecasting = asyncHandler(async (req, res) => {
    // Basic moving average or trend forecasting based on last 3 months
    const data = await SalesInvoice.aggregate([
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                total: { $sum: "$grandTotal" }
            }
        },
        { $sort: { "_id": -1 } },
        { $limit: 3 }
    ]);

    // Simple extrapolation logic here or just return historical trends for the UI to predict
    res.json({
        historical: data,
        forecastNextMonth: data.length > 0 ? (data.reduce((a, b) => a + b.total, 0) / data.length) * 1.05 : 0
    });
});
