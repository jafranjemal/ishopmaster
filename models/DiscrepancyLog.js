const mongoose = require("mongoose");

const DiscrepancyLogSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ["Purchase", "Stock", "Cash", "Repair"],
        required: true
    },
    category: { type: String }, // e.g., "Short Shipment", "Cash Mismatch"
    reference_id: { type: mongoose.Schema.Types.ObjectId, required: true }, // e.g., PurchaseID, ShiftID
    field_name: { type: String }, // e.g., "grand_total", "physical_cash"
    expected_value: mongoose.Schema.Types.Mixed,
    actual_value: mongoose.Schema.Types.Mixed,
    delta: mongoose.Schema.Types.Mixed,
    reason: { type: String, required: true },
    resolved: { type: Boolean, default: false },
    resolved_at: { type: Date },
    resolved_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

module.exports = mongoose.model("DiscrepancyLog", DiscrepancyLogSchema);
