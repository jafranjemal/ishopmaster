// models/ItemVariant.js (NEW FILE)
const mongoose = require("mongoose");

const ItemVariantSchema = new mongoose.Schema({
    item_id: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },

    // Flexible variantAttributes for specs like color, storage, RAM, etc.
    // Can be empty array for base items without variants
    variantAttributes: [
        {
            key: { type: String },   // e.g., "Color" - not required
            value: { type: String } // e.g., "Rose Gold" - not required
        }
    ],

    // A unique name for the variant, e.g., "APPLE IPHONE 12 PRO - 256GB ROSE GOLD"
    variantName: { type: String, required: true, unique: true },

    sku: { type: String, unique: true, sparse: true }, // Stock Keeping Unit
    barcode: { type: String, unique: true, sparse: true },

    // Image for the variant
    variantImage: { type: String }, // Image URL
    variantImagePublicId: { type: String }, // Cloudinary Public ID

    // Default pricing for this variant
    defaultSellingPrice: { type: Number, default: 0 },
    lastUnitCost: { type: Number, default: 0 },

    // Stock Tracking for Enterprise Procurement
    stockTracking: {
        currentStock: { type: Number, default: 0 },
        availableForSale: { type: Number, default: 0 },
        reorderPoint: { type: Number, default: 5 },
        preferredSupplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null }
    }

}, { timestamps: true });

const ItemVariant = mongoose.model("ItemVariant", ItemVariantSchema);
module.exports = ItemVariant;
