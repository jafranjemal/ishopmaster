const Sale = require('../models/SalesInvoice');
const Purchase = require('../models/Purchase');
const Expense = require('../models/Expense');
const Item = require('../models/Items');
const moment = require('moment');

// Generate Profit & Loss Statement
exports.getProfitLossStatement = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const companyId = req.user?.company || req.query.Company;

        if (!startDate || !endDate) {
            return res.status(400).json({ message: 'Start date and end date required' });
        }

        const dateFilter = {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        };

        // 1. REVENUE from Sales
        const salesRevenue = await Sale.aggregate([
            {
                $match: {
                    Company: companyId,
                    createdAt: dateFilter,
                    return_invoice_status: { $ne: 'returned' }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$total_amount' },
                    salesCount: { $sum: 1 }
                }
            }
        ]);

        const revenue = salesRevenue[0]?.totalRevenue || 0;
        const salesCount = salesRevenue[0]?.salesCount || 0;

        // 2. COGS (Cost of Goods Sold) from Sales items
        const cogs = await Sale.aggregate([
            {
                $match: {
                    Company: companyId,
                    createdAt: dateFilter,
                    status: { $ne: 'Reversed' }
                }
            },
            { $unwind: '$items' },
            {
                $lookup: {
                    from: 'serializedstocks',
                    let: { serials: '$items.serialNumbers', isSer: '$items.isSerialized' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$$isSer', true] },
                                        { $in: ['$serialNumber', { $ifNull: ['$$serials', []] }] }
                                    ]
                                }
                            }
                        },
                        { $project: { unitCost: 1 } }
                    ],
                    as: 'serData'
                }
            },
            {
                $lookup: {
                    from: 'nonserializedstocks',
                    let: { itemId: '$items.item_id', batch: '$items.batch_number', isSer: '$items.isSerialized' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$$isSer', false] },
                                        { $eq: ['$item_id', '$$itemId'] },
                                        { $eq: ['$batch_number', '$$batch'] }
                                    ]
                                }
                            }
                        },
                        { $project: { unitCost: 1 } }
                    ],
                    as: 'nonSerData'
                }
            },
            {
                $addFields: {
                    itemUnitCost: {
                        $cond: {
                            if: '$items.isSerialized',
                            then: { $sum: '$serData.unitCost' }, // Sum of individual serial costs
                            else: {
                                $multiply: [
                                    { $ifNull: [{ $arrayElemAt: ['$nonSerData.unitCost', 0] }, 0] },
                                    '$items.quantity'
                                ]
                            }
                        }
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalCOGS: { $sum: '$itemUnitCost' }
                }
            }
        ]);

        const totalCOGS = cogs[0]?.totalCOGS || 0;
        const grossProfit = revenue - totalCOGS;
        const grossMargin = revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(2) : 0;

        // 3. OPERATING EXPENSES
        const expensesByCategory = await Expense.aggregate([
            {
                $match: {
                    Company: companyId,
                    date: dateFilter
                }
            },
            {
                $group: {
                    _id: '$category',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { total: -1 } }
        ]);

        const totalOperatingExpenses = expensesByCategory.reduce((sum, cat) => sum + cat.total, 0);

        // 4. NET INCOME
        const netIncome = grossProfit - totalOperatingExpenses;
        const netMargin = revenue > 0 ? ((netIncome / revenue) * 100).toFixed(2) : 0;

        // Period info
        const periodDays = moment(endDate).diff(moment(startDate), 'days') + 1;

        res.json({
            period: {
                start: startDate,
                end: endDate,
                days: periodDays
            },
            revenue: {
                total: revenue,
                salesCount
            },
            cogs: {
                total: totalCOGS
            },
            grossProfit: {
                amount: grossProfit,
                margin: parseFloat(grossMargin)
            },
            operatingExpenses: {
                total: totalOperatingExpenses,
                breakdown: expensesByCategory.map(cat => ({
                    category: cat._id,
                    amount: cat.total,
                    count: cat.count,
                    percentage: ((cat.total / totalOperatingExpenses) * 100).toFixed(2)
                }))
            },
            netIncome: {
                amount: netIncome,
                margin: parseFloat(netMargin)
            }
        });
    } catch (error) {
        console.error('P&L statement error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Compare P&L across periods
exports.compareProfitLoss = async (req, res) => {
    try {
        const { currentStart, currentEnd, previousStart, previousEnd } = req.query;
        const companyId = req.user?.company || req.query.Company;

        if (!currentStart || !currentEnd || !previousStart || !previousEnd) {
            return res.status(400).json({ message: 'All date parameters required' });
        }

        // Helper function to get P&L for a period
        const getPeriodPL = async (startDate, endDate) => {
            const dateFilter = { $gte: new Date(startDate), $lte: new Date(endDate) };

            const salesData = await Sale.aggregate([
                { $match: { Company: companyId, createdAt: dateFilter, return_invoice_status: { $ne: 'returned' } } },
                { $group: { _id: null, revenue: { $sum: '$total_amount' } } }
            ]);

            const cogsData = await Sale.aggregate([
                { $match: { Company: companyId, createdAt: dateFilter, status: { $ne: 'Reversed' } } },
                { $unwind: '$items' },
                {
                    $lookup: {
                        from: 'serializedstocks',
                        let: { serials: '$items.serialNumbers', isSer: '$items.isSerialized' },
                        pipeline: [
                            { $match: { $expr: { $and: [{ $eq: ['$$isSer', true] }, { $in: ['$serialNumber', { $ifNull: ['$$serials', []] }] }] } } },
                            { $project: { unitCost: 1 } }
                        ],
                        as: 'serData'
                    }
                },
                {
                    $lookup: {
                        from: 'nonserializedstocks',
                        let: { itemId: '$items.item_id', batch: '$items.batch_number', isSer: '$items.isSerialized' },
                        pipeline: [
                            { $match: { $expr: { $and: [{ $eq: ['$$isSer', false] }, { $eq: ['$item_id', '$$itemId'] }, { $eq: ['$batch_number', '$$batch'] }] } } },
                            { $project: { unitCost: 1 } }
                        ],
                        as: 'nonSerData'
                    }
                },
                {
                    $addFields: {
                        itemUnitCost: {
                            $cond: {
                                if: '$items.isSerialized',
                                then: { $sum: '$serData.unitCost' },
                                else: { $multiply: [{ $ifNull: [{ $arrayElemAt: ['$nonSerData.unitCost', 0] }, 0] }, '$items.quantity'] }
                            }
                        }
                    }
                },
                { $group: { _id: null, cogs: { $sum: '$itemUnitCost' } } }
            ]);

            const expData = await Expense.aggregate([
                { $match: { Company: companyId, date: dateFilter } },
                { $group: { _id: null, expenses: { $sum: '$amount' } } }
            ]);

            const revenue = salesData[0]?.revenue || 0;
            const cogs = cogsData[0]?.cogs || 0;
            const expenses = expData[0]?.expenses || 0;
            const grossProfit = revenue - cogs;
            const netIncome = grossProfit - expenses;

            return { revenue, cogs, grossProfit, expenses, netIncome };
        };

        const current = await getPeriodPL(currentStart, currentEnd);
        const previous = await getPeriodPL(previousStart, previousEnd);

        const calculateChange = (curr, prev) => {
            if (prev === 0) return curr > 0 ? 100 : 0;
            return (((curr - prev) / Math.abs(prev)) * 100).toFixed(2);
        };

        res.json({
            current: {
                period: { start: currentStart, end: currentEnd },
                ...current
            },
            previous: {
                period: { start: previousStart, end: previousEnd },
                ...previous
            },
            changes: {
                revenue: parseFloat(calculateChange(current.revenue, previous.revenue)),
                cogs: parseFloat(calculateChange(current.cogs, previous.cogs)),
                grossProfit: parseFloat(calculateChange(current.grossProfit, previous.grossProfit)),
                expenses: parseFloat(calculateChange(current.expenses, previous.expenses)),
                netIncome: parseFloat(calculateChange(current.netIncome, previous.netIncome))
            }
        });
    } catch (error) {
        console.error('P&L comparison error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
