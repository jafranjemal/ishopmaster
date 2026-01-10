const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema({
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier" }, // Optional if it's a trade-in
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" }, // For trade-ins
  purchase_type: { type: String, enum: ["Supplier", "Trade-In"], default: "Supplier" },
  referenceNumber: { type: String, unique: true, required: true },
  purchaseDate: { type: Date, default: Date.now },
  payment_type: { type: String, enum: ["Cash", "Credit", "Other"], },
  bill_proof: { type: String }, // Image URL
  total_items_count: { type: Number, required: true },
  grand_total: { type: Number, required: true },
  purchase_tax: { type: Number, default: 0 },
  purchase_discount: { type: Number, default: 0 },
  additional_notes: { type: String },
  purchase_status: {
    type: String,
    enum: ["Received", "Pending Verification", "Cancelled", "Discrepancy"],
    default: "Pending Verification",
  },
  verification_date: { type: Date },
  verification_notes: { type: String },
  discrepancy_details: {
    expected_grand_total: { type: Number },
    actual_grand_total: { type: Number },
    mismatch_reason: { type: String }
  },
  payment_status: {
    type: String,
    enum: ["Not Paid", "Partial", "Paid"],
    default: "Not Paid",
  },
  payment_due_amount: { type: Number, default: 0 },
  purchasedItems: [
    {
      item_id: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
      variant_id: { type: mongoose.Schema.Types.ObjectId, ref: "ItemVariant" },
      purchaseQty: { type: Number, required: true },
      discount: { type: Number, default: 0 },
      unitCost: { type: Number, required: true },
      unit: { type: String, default: "pcs" },
      total_price: { type: Number, required: true },
      profitMargin: { type: Number, required: false },
      sellingPrice: { type: Number, required: true },
      batch_number: { type: String, required: true }, // Unique Batch ID
      isSerialized: { type: Boolean, default: false },
      serializedItems: [
      ]
    },
  ],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

const Purchase = mongoose.model("Purchase", purchaseSchema);
module.exports = Purchase;

