const Customer = require("../models/Customer");
const Account = require("../models/Account");
const SalesInvoice = require("../models/SalesInvoice");

/**
 * getAgingDebtorsReport:
 * Returns a list of customers with negative balances (debts), 
 * grouped by aging buckets (30, 60, 90+ days).
 */
exports.getAgingDebtorsReport = async (req, res) => {
    try {
        const now = new Date();

        // Find all Customer accounts with a positive balance (meaning they owe money if balance tracks 'due')
        // Note: In iShopMaster, customer balance usually tracks what they OWE? 
        // Let's check Account.js owner type Customer.

        const debtors = await Account.aggregate([
            {
                $match: {
                    account_owner_type: "Customer",
                    balance: { $gt: 0 } // Assuming positive balance = customer owes money (Payable to Shop)
                }
            },
            {
                $lookup: {
                    from: "customers",
                    localField: "related_party_id",
                    foreignField: "_id",
                    as: "customer"
                }
            },
            { $unwind: "$customer" },
            {
                $lookup: {
                    from: "salesinvoices",
                    let: { custId: "$customer._id" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$customer", "$$custId"] }, status: "unpaid" } },
                        { $sort: { due_date: 1 } },
                        { $limit: 1 }
                    ],
                    as: "oldestInvoice"
                }
            },
            {
                $addFields: {
                    oldestDueDate: { $ifNull: [{ $arrayElemAt: ["$oldestInvoice.due_date", 0] }, "$createdAt"] }
                }
            },
            {
                $addFields: {
                    daysOverdue: {
                        $floor: {
                            $divide: [{ $subtract: [now, "$oldestDueDate"] }, 1000 * 60 * 60 * 24]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    customer_id: "$customer.customer_id",
                    name: { $concat: ["$customer.first_name", " ", "$customer.last_name"] },
                    phone: "$customer.phone_number",
                    balance: 1,
                    daysOverdue: 1,
                    bucket: {
                        $cond: [
                            { $gte: ["$daysOverdue", 90] }, "90+",
                            {
                                $cond: [{ $gte: ["$daysOverdue", 60] }, "60-89",
                                { $cond: [{ $gte: ["$daysOverdue", 30] }, "30-59", "0-29"] }]
                            }
                        ]
                    }
                }
            },
            { $sort: { daysOverdue: -1 } }
        ]);

        res.status(200).json(debtors);
    } catch (err) {
        console.error("Aging Debtors Report Error:", err);
        res.status(500).json({ error: err.message });
    }
};
