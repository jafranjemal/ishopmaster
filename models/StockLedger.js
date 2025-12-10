// models/StockLedger.js
const mongoose = require("mongoose");

const StockLedgerSchema = new mongoose.Schema({
  item_id: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
  variant_id: { type: mongoose.Schema.Types.ObjectId, ref: "ItemVariant" },

  purchase_id: { type: mongoose.Schema.Types.ObjectId, ref: "Purchase" },

  serialNumber: { type: String }, // only for serialized items

  movementType: {
    type: String,
    enum: [
      "Purchase-In",
      "Purchase-Delete-Reverse",
      "Sale-Out",
      "Sale-Return-In",
      "Adjustment-In",
      "Adjustment-Out",
      "Damage",
      "Correction"
    ],
    required: true
  },

  qty: { type: Number, required: true }, // Always + for IN, - for OUT

  opening_balance: { type: Number, required: true },
  closing_balance: { type: Number, required: true },

  batch_number: { type: String },

  unitCost: { type: Number },
  sellingPrice: { type: Number },

  memo: { type: String },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("StockLedger", StockLedgerSchema);
