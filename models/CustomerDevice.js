const mongoose = require('mongoose');

const customerDeviceSchema = new mongoose.Schema({
    // 1. UNIQUE IDENTIFIERS
    serialNumber: { type: String, unique: true, required: true }, // IMEI/Serial
    imei2: { type: String }, // Dual SIM devices

    // 2. PRODUCT LINKS (Hierarchical)
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ItemVariant' },

    // 3. PHYSICAL SPECS (Snapshot from Variant)
    deviceName: { type: String }, // e.g., "iPhone 13 Pro - 128GB - Blue"
    brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand' },
    modelId: { type: mongoose.Schema.Types.ObjectId, ref: 'PhoneModel' },
    color: String,
    storage: String,
    RAM: String,
    network: String,

    // 4. OWNERSHIP & ORIGIN
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    source: {
        type: String,
        enum: ['Sales', 'ThirdParty'],
        default: 'ThirdParty',
        required: true
    },
    isExternalPurchase: { type: Boolean, default: false }, // Not sold by us

    // 5. DEVICE STATUS
    status: {
        type: String,
        enum: ['Active', 'InRepair', 'Replaced', 'Returned', 'Blacklisted'],
        default: 'Active'
    },

    // 6. WARRANTY ENGINE (Forensic Snapshot)
    warranty: {
        policyName: String,
        purchaseDate: Date,
        replacementUntil: Date, // Phase 1 expiry
        serviceUntil: Date,     // Phase 2 expiry
        termsApplied: [String], // Exact T&Cs at time of sale
        phase1Days: Number,     // Original policy duration
        phase2Days: Number
    },

    // 7. REFURBISHMENT DATA (from GRN)
    refurbNotes: [String], // e.g., ["Battery: 85%", "Screen: Original"]

    // 8. SECURITY & CREDENTIALS
    passwordType: { type: String, default: 'text' },
    password: { type: String }, // Should be encrypted

    // 9. SERVICE HISTORY SUMMARY
    serviceHistory: [{
        inspectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeviceInspection' },
        date: Date,
        description: String,
        status: String
    }],

    // 10. SALES REFERENCE (if sold by us)
    salesInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesInvoice' }

}, { timestamps: true });

// Index for fast customer lookups
customerDeviceSchema.index({ owner: 1, createdAt: -1 });
customerDeviceSchema.index({ serialNumber: 1 });
customerDeviceSchema.index({ source: 1, status: 1 });

module.exports = mongoose.model('CustomerDevice', customerDeviceSchema);
