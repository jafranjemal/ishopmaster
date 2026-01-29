
const mongoose = require("mongoose");

const accountSchema = new mongoose.Schema({
  account_name: { type: String, required: true },
  account_type: {
    type: String,
    enum: [
      "Cash",
      "Bank",
      "Savings",
      "Current", // Added "Current" account type
      "Loan",
      "Credit Card",
      "Investment",
      "Expense",
      "Income",
      "Receivable",
      "Payable",
      "Salary",
      "Equity",
      "Prepaid",
      "Other",
      "Supplier",    // Supplier account type
      "Customer",    // Customer account type
    ],
    required: true,
  },
  balance: { type: Number, default: 0 },
  account_owner_type: {
    type: String,
    enum: ["Company", "Customer", "Supplier", "Employees"],
    required: true,
    default: "Company"
  },
  related_party_id: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: "account_owner_type", // Dynamically reference the model based on owner type
    required: true,
  },
  description: { type: String },
  activeShiftId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shift'
  },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

const Account = mongoose.model("Account", accountSchema);
module.exports = Account
