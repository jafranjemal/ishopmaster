const mongoose = require("mongoose");

const WarrantyPolicySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    phase1_days: { type: Number, required: true, default: 30 }, // Full Replacement Phase
    phase2_days: { type: Number, required: true, default: 60 }, // Service-Only Phase
    terms_list: { type: [String], default: [] }, // Array of Terms & Conditions strings
    is_active: { type: Boolean, default: true },
    is_deleted: { type: Boolean, default: false } // Soft delete
}, { timestamps: true });

module.exports = mongoose.model("WarrantyPolicy", WarrantyPolicySchema);
