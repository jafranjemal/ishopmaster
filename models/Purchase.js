const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema({
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
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
    enum: ["Received", "Pending", "Cancelled"], 
    default: "Pending",
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
      purchaseQty: { type: Number, required: true },
      discount: { type: Number, default: 0 },
      unitCost: { type: Number, required: true },
      unit: { type: String, required: true },
      total_price: { type: Number, required: true },
      profitMargin: { type: Number, required: false },
      sellingPrice: { type: Number, required: true },
      batch_number: { type: String, required: true }, // Unique Batch ID
    },
  ],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Purchase", purchaseSchema);
