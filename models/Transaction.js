const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
  amount: { type: Number, required: true },
  transaction_type: { type: String, enum: ["Deposit", "Withdrawal"], required: true },
  reason: { type: String, required: true }, // For example, "Salary", "Purchase", "Payment", etc.
  transaction_date: { type: Date, default: Date.now },
  balance_after_transaction: { type: Number, required: true }, // This is the new balance after the transaction
  agent_id: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier.contacts" }, // Optional link to specific agent
  segment_id: { type: String }, // Optional link to specific brand segment
});

const Transaction = mongoose.model("Transaction", transactionSchema);
module.exports = Transaction;
