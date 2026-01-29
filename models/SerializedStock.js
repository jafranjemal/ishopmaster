const mongoose = require("mongoose");

const SerializedStockSchema = new mongoose.Schema({
  variant_id: { type: mongoose.Schema.Types.ObjectId, ref: "ItemVariant" },

  item_id: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
  purchase_id: { type: mongoose.Schema.Types.ObjectId, ref: "Purchase", required: true },
  serialNumber: { type: String, required: true, unique: true }, // Unique identifier like IMEI
  batch_number: { type: String, required: true }, // Batch for traceability
  status: { type: String, enum: ["Available", "Incoming", "On Hold", "Sold", "Damaged"], default: "Incoming" },
  unitCost: { type: Number, required: true }, // Cost of the item
  sellingPrice: { type: Number, required: true }, // Selling price per unit
  purchaseDate: { type: Date, required: true },
  sold_date: { type: Date }, // Date of sale (if applicable)

  ramSize: { type: String }, // RAM size
  storageSize: { type: String }, // Storage size
  displaySize: { type: String }, // Display size
  rearCamera: { type: String }, // Rear camera pixels
  frontCamera: { type: String }, // Front camera pixels
  fingerprint: { type: Boolean }, // Fingerprint availability
  networkType: { type: String }, // Supported networks (e.g., 4G, 5G)
  simType: { type: String }, // SIM type (e.g., Nano)
  batteryCapacity: { type: Number }, // Number of SIM slots
  batteryHealth: { type: Number }, // Number of SIM slots
  condition: { type: String, enum: ["Brand New", "Like New", "Open Box", "Used Grade A", "Used Grade B", "Used", "Pre-Owned", "Refurbished", "Active", "Non-Active", "Damaged"], required: true },
  previouslySold: { type: Boolean, default: false },
  returnReference: { type: mongoose.Schema.Types.ObjectId, ref: "SalesInvoice" },
  lastReturnReason: { type: String },

  warrantyPolicyId: { type: mongoose.Schema.Types.ObjectId, ref: "WarrantyPolicy" },
  refurb_tags: { type: [String], default: [] },
  notes: { type: String }, // Additional notes about the item

}, { timestamps: true });

module.exports = mongoose.model("SerializedStock", SerializedStockSchema);
