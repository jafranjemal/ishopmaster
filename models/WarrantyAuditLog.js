const mongoose = require("mongoose");

const WarrantyAuditLogSchema = new mongoose.Schema({
    imei: { type: String, required: true, index: true },
    action_taken: { type: String, required: true }, // e.g., "Manual Check", "Claim Attempt", "Policy Update"
    current_status_at_time_of_check: { type: String },
    performed_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model("WarrantyAuditLog", WarrantyAuditLogSchema);
