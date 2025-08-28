// models/ItemVariant.js (NEW FILE)
const mongoose = require("mongoose");

const ItemVariantSchema = new mongoose.Schema({
    item_id: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    
    // Flexible variantAttributes for specs like color, storage, RAM, etc.
 
variantAttributes: [
        {
            key: { type: String,  },   // e.g., "Color"
            value: { type: String,  } // e.g., "Rose Gold"
        }
    ],
    // A unique name for the variant, e.g., "APPLE IPHONE 12 PRO - 256GB ROSE GOLD"
    variantName: { type: String, required: true, unique: true }, 

    sku: { type: String, unique: true, sparse: true }, // Stock Keeping Unit
    barcode: { type: String, unique: true, sparse: true },
    
    // Default pricing for this variant
    defaultSellingPrice: { type: Number, default: 0 },
    lastUnitCost: { type: Number, default: 0 }

}, { timestamps: true });

const ItemVariant = mongoose.model("ItemVariant", ItemVariantSchema);
module.exports = ItemVariant;