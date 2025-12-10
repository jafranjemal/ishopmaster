// models/AuditLog.js
const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // optional

  action: {
    type: String,
    enum: [
      "PURCHASE_CREATED",
      "PURCHASE_UPDATED",
      "PURCHASE_DELETED",
      "STOCK_ADJUSTED",
      "STOCK_DELETED",
      "ITEM_EDITED",
      "ACCOUNT_UPDATED"
    ],
    required: true
  },

  reference_id: { type: mongoose.Schema.Types.ObjectId }, // purchase / item / account / stock

  description: { type: String, required: false },  
  old_value: { type: Object },
  new_value: { type: Object },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("AuditLog", AuditLogSchema);
