const mongoose = require("mongoose");

const SerializedStockSchema = new mongoose.Schema({
  item_id: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
  purchase_id: { type: mongoose.Schema.Types.ObjectId, ref: "Purchase", required: true },
  serialNumber: { type: String, required: true, unique: true }, // Unique identifier like IMEI
  batch_number: { type: String, required: true }, // Batch for traceability
  status: { type: String, enum: ["Available", "Sold", "Damaged"], default: "Available" },
  unitCost: { type: Number, required: true }, // Cost of the item
  sellingPrice: { type: Number, required: true }, // Selling price per unit
  purchaseDate: { type: Date, required: true },
  sold_date: { type: Date }, // Date of sale (if applicable)
}, { timestamps: true });

module.exports = mongoose.model("SerializedStock", SerializedStockSchema);
