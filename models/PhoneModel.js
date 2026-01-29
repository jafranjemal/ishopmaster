const mongoose = require('mongoose');

const phoneModelSchema = new mongoose.Schema({
    brandId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Brand',
        required: true,
        index: true // Index for faster lookups by brand
    },
    model_name: {
        type: String,
        required: true,
        uppercase: true,
        trim: true
    },
    // Search Helper (e.g., "13 Pro Max" for "iPhone 13 Pro Max")
    aliases: [String],

    image_url: { type: String },

    // --- ERP SPECS (Auto-Fill Data) ---
    specifications: {
        storage_options: [{ type: String }], // e.g. ["128GB", "256GB", "512GB"]
        ram_options: [{ type: String }],     // e.g. ["6GB", "8GB"]
        display_size: { type: String },      // e.g. "6.7 inches"
        battery_capacity: { type: String },  // e.g. "4352 mAh"
        network_type: {
            type: String,
            enum: ["4G", "5G", "LTE", "WiFi-Only"],
            default: "5G"
        }
    },

    // Standardized Colors
    available_colors: [{
        name: String, // "Sierra Blue"
        hex: String   // "#9BB5CE" (Optional, good for UI)
    }],

    release_year: { type: Number }, // Good for sorting "Newest First"

    // Lifecycle
    isActive: { type: Boolean, default: true }

}, { timestamps: true }); // <--- Mandatory for ERP

// Compound index to prevent "Samsung S24" appearing twice
phoneModelSchema.index({ model_name: 1, brandId: 1 }, { unique: true });

const PhoneModel = mongoose.model('PhoneModel', phoneModelSchema);
module.exports = PhoneModel;