const mongoose = require("mongoose");

const NonSerializedStockSchema = new mongoose.Schema({
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
  condition: { type: String, enum: ["Brand New", "Used", "Refurbished", "Damaged"], required: true },
  expiryDate: { type: Date }, // Optional: Expiry date for consumables
  adjustmentReason: { type: String }, // Optional: Reason for adjustment
  unit: { type: String }, // Optional: Reason for adjustment
  status: { type: String, enum: ["Available", "Incoming", "On Hold", "Sold", "Damaged"], default: "Incoming" },
  purchaseDate: { type: Date, required: true },
}, { timestamps: true });


module.exports = mongoose.model("NonSerializedStock", NonSerializedStockSchema);
