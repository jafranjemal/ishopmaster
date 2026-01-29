const mongoose = require("mongoose");

const purchaseOrderSchema = new mongoose.Schema({
    poNumber: { type: String, unique: true, required: true }, // e.g., PO-2026-001
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },

    // Vendor Representation
    ref_agent_id: { type: mongoose.Schema.Types.ObjectId },
    ref_agent_name: { type: String },

    // Dates
    createdDate: { type: Date, default: Date.now },
    expectedDate: { type: Date },

    // Status Workflow
    status: {
        type: String,
        enum: ['DRAFT', 'SENT', 'PARTIAL', 'CLOSED', 'CANCELLED'],
        default: 'DRAFT'
    },

    // Receiving Logic
    receivingStatus: {
        type: String,
        enum: ['Pending', 'Partial', 'Fully Received'],
        default: 'Pending'
    },

    // Financials
    totalAmount: { type: Number, default: 0 },
    notes: { type: String },

    // Line Items
    items: [{
        item_id: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
        variant_id: { type: mongoose.Schema.Types.ObjectId, ref: "ItemVariant" },
        itemName: { type: String }, // Snapshot

        orderedQty: { type: Number, required: true },
        receivedQty: { type: Number, default: 0 }, // Verified GRN count
        unitCost: { type: Number, required: true },
        totalPrice: { type: Number },

        itemStatus: {
            type: String,
            enum: ['Pending', 'Partial', 'Fully Received'],
            default: 'Pending'
        }
    }],

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }

}, { timestamps: true });

const PurchaseOrder = mongoose.model("PurchaseOrder", purchaseOrderSchema);
module.exports = PurchaseOrder;
