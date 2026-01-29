const Warranty = require("../models/Warranty");
const SalesInvoice = require("../models/SalesInvoice");
const Ticket = require("../models/Ticket");
const mongoose = require("mongoose");
const moment = require("moment");

/**
 * createWarranty:
 * Triggered on successful sale to generate warranty records.
 */
exports.generateWarrantiesForInvoice = async (invoiceId) => {
    const invoice = await SalesInvoice.findById(invoiceId).populate("items.item_id");
    if (!invoice) throw new Error("Invoice not found");

    const warranties = [];

    // Generate for serialized items
    for (const item of invoice.items) {
        if (item.isSerialized && item.serialNumbers && item.serialNumbers.length > 0) {
            for (const serial of item.serialNumbers) {
                const duration = item.warranty || 0;
                const unit = (item.warrantyUnit || "Days").toLowerCase();
                const startDate = moment();
                const endDate = moment().add(duration, unit);

                warranties.push({
                    invoice_id: invoice._id,
                    customer_id: invoice.customer,
                    item_id: item.item_id._id,
                    serial_number: serial,
                    item_name: item.itemName,
                    type: "Product",
                    start_date: startDate.toDate(),
                    duration_days: duration, // We store duration as provided
                    end_date: endDate.toDate(),
                });
            }
        }
        // DELETED: Fallback for non-serialized items. No serial = No warranty record.
    }

    // Generate for service items
    if (invoice.serviceItems) {
        for (const service of invoice.serviceItems) {
            const duration = service.warranty || 0;
            const unit = "days"; // Services usually in days, fallback to 90 if empty logic
            const startDate = moment();
            const endDate = moment().add(duration || 90, unit);

            warranties.push({
                invoice_id: invoice._id,
                customer_id: invoice.customer,
                item_id: service.serviceItemId,
                item_name: service.name,
                type: "Service",
                start_date: startDate.toDate(),
                duration_days: duration || 90,
                end_date: endDate.toDate(),
            });
        }
    }

    // Generate warranties sequentially to trigger pre('save') hooks for ID generation
    if (warranties.length > 0) {
        // await Warranty.insertMany(warranties);
        for (const w of warranties) {
            await new Warranty(w).save();
        }
    }
};

/**
 * voidWarrantiesForInvoice:
 * Marks all warranties linked to an invoice as Voided.
 */
exports.voidWarrantiesForInvoice = async (invoiceId) => {
    await Warranty.updateMany(
        { invoice_id: invoiceId },
        { $set: { status: "Voided", notes: "Voided due to sale reversal/return" } }
    );
};

/**
 * claimWarranty:
 * Validates and records a warranty claim.
 */
exports.claimWarranty = async (req, res) => {
    const { warranty_id, ticket_id, reason } = req.body;

    try {
        const warranty = await Warranty.findOne({ warranty_id });
        if (!warranty) return res.status(404).json({ message: "Warranty record not found" });

        if (warranty.status !== "Active") {
            return res.status(400).json({ message: `Warranty is not active. Status: ${warranty.status}` });
        }

        if (new Date() > warranty.end_date) {
            warranty.status = "Expired";
            await warranty.save();
            return res.status(400).json({ message: "Warranty has expired" });
        }

        // Attach claim to warranty
        warranty.claims.push({
            ticket_id,
            claim_date: new Date(),
            reason,
            outcome: "Pending"
        });

        await warranty.save();

        res.status(200).json({ message: "Warranty claim recorded.", warranty });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * getWarrantyDashboard:
 * Returns overview of warranties (Active, Expiring Soon, Expired).
 */
exports.getWarrantyDashboard = async (req, res) => {
    try {
        const now = new Date();
        const expiringSoonDate = new Date();
        expiringSoonDate.setDate(now.getDate() + 30);

        const stats = await Warranty.aggregate([
            {
                $facet: {
                    activeCount: [{ $match: { status: "Active", end_date: { $gt: expiringSoonDate } } }, { $count: "count" }],
                    expiringSoon: [{ $match: { status: "Active", end_date: { $lte: expiringSoonDate, $gt: now } } }, { $count: "count" }],
                    expiredCount: [{ $match: { $or: [{ status: "Expired" }, { end_date: { $lte: now } }] } }, { $count: "count" }],
                    claimsCount: [{ $unwind: "$claims" }, { $count: "count" }]
                }
            }
        ]);

        res.status(200).json(stats[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * getWarranties:
 * Returns a list of all warranties with filters and pagination.
 */
exports.getWarranties = async (req, res) => {
    try {
        const { status, type, search, page = 1, limit = 10 } = req.query;
        const query = {};

        if (status) query.status = status;
        if (type) query.type = type;
        if (search) {
            query.$or = [
                { warranty_id: { $regex: search, $options: "i" } },
                { item_name: { $regex: search, $options: "i" } },
                { serial_number: { $regex: search, $options: "i" } }
            ];
        }

        const warranties = await Warranty.find(query)
            .populate("customer_id", "first_name last_name phone")
            .populate("invoice_id", "invoice_id")
            .populate("item_id", "itemName")
            .sort("-createdAt")
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const count = await Warranty.countDocuments(query);

        res.status(200).json({
            warranties,
            totalPages: Math.ceil(count / limit),
            currentPage: Number(page),
            totalRecords: count
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * updateWarranty:
 * Updates warranty status or notes.
 */
exports.updateWarranty = async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    try {
        const warranty = await Warranty.findByIdAndUpdate(id, updates, { new: true });
        if (!warranty) return res.status(404).json({ message: "Warranty not found" });

        res.status(200).json({ message: "Warranty updated.", warranty });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
