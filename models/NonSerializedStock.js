const mongoose = require("mongoose");

const NonSerializedStockSchema = new mongoose.Schema({
  variant_id: { type: mongoose.Schema.Types.ObjectId, ref: "ItemVariant" },
  item_id: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
  purchase_id: { type: mongoose.Schema.Types.ObjectId, ref: "Purchase", required: true },
  batch_number: { type: String, required: true }, // Unique for batch
  purchaseQty: { type: Number, required: true }, // Total quantity purchased
  availableQty: { type: Number, required: true }, // Remaining stock
  soldQty: { type: Number, default: 0 }, // Quantity sold
  adjustmentQty: { type: Number, default: 0 }, // Adjustments for returns, damages
  unitCost: { type: Number, required: true }, // Purchase price per unit
  beforePurchaseAvailableQty: { type: Number, required: false, default: 0 }, // Purchase price per unit
  sellingPrice: { type: Number, required: true }, // Selling price per unit
  condition: { type: String, enum: ["Brand New", "Like New", "Open Box", "Used Grade A", "Used Grade B", "Used", "Pre-Owned", "Refurbished", "Active", "Non-Active", "Damaged"], required: true },
  expiryDate: { type: Date }, // Optional: Expiry date for consumables
  adjustmentReason: { type: String }, // Optional: Reason for adjustment
  unit: { type: String }, // Optional: Reason for adjustment
  status: { type: String, enum: ["Available", "Incoming", "On Hold", "Sold", "Damaged"], default: "Incoming" },
  purchaseDate: { type: Date, required: true },
}, { timestamps: true });


NonSerializedStockSchema.index({ item_id: 1, variant_id: 1, availableQty: 1 });
NonSerializedStockSchema.index({ availableQty: 1 });
NonSerializedStockSchema.index({ purchaseDate: -1 });

module.exports = mongoose.model("NonSerializedStock", NonSerializedStockSchema);
