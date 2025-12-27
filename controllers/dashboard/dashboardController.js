const SalesInvoice = require("../../models/SalesInvoice");
const RepairOrder = require("../../models/RepairOrder");
const Stock = require("../../models/Stock");
const mongoose = require("mongoose");

/**
 * Get unified dashboard metrics
 */
exports.getDashboardSummary = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. Sales & Service Metrics
        const salesStats = await SalesInvoice.aggregate([
            { $match: { invoice_date: { $gte: today } } },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$total_amount" },
                    totalPaid: { $sum: "$total_paid_amount" },
                    mixedCount: { $sum: { $cond: [{ $eq: ["$invoice_type", "mixed"] }, 1, 0] } }
                }
            }
        ]);

        // 2. Repair Metrics
        const repairStats = await RepairOrder.aggregate([
            {
                $group: {
                    _id: null,
                    pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
                    completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
                    total: { $sum: 1 }
                }
            }
        ]);

        // 3. Inventory Alerts
        const lowStock = await Stock.find({ available_qty: { $lte: 5 } })
            .populate('item_id', 'itemName')
            .limit(5);

        res.status(200).json({
            success: true,
            data: {
                sales: salesStats[0] || { totalRevenue: 0, totalPaid: 0 },
                repairs: {
                    pending: repairStats[0]?.pending || 0,
                    successRate: repairStats[0] ? ((repairStats[0].completed / repairStats[0].total) * 100).toFixed(1) : 0
                },
                inventory: lowStock.map(s => ({
                    message: `${s.item_id?.itemName || 'Item'} is low on stock (${s.available_qty} left)`
                }))
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
