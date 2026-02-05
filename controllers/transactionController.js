const Transaction = require("../models/Transaction");
const Account = require("../models/Account");

const mongoose = require('mongoose');

exports.createTransaction = async (req, res) => {
  try {
    const { account_id, amount, transaction_type, reason, agent_id, segment_id } = req.body;

    if (!account_id || !amount || !transaction_type || !reason) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (amount <= 0) {
      return res.status(400).json({ message: "Amount must be positive" });
    }

    if (!["Deposit", "Withdrawal"].includes(transaction_type)) {
      return res.status(400).json({ message: "Invalid transaction type" });
    }

    // Fetch the account
    const account = await Account.findById(account_id);
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    // Unified Balance Logic (from paymentController.js)
    const numericAmount = Number(amount);
    const absAmount = Math.abs(numericAmount);

    // Deposits to a Payable/Supplier account must DECREASE the debt (debit)
    // Withdrawals from a Payable/Supplier account must INCREASE the debt (credit)
    const isLiability = account.account_type === 'Payable' || account.account_owner_type === 'Supplier';

    const adjustment = (transaction_type === "Deposit")
      ? (isLiability ? -absAmount : absAmount)
      : (isLiability ? absAmount : -absAmount);

    const balance_after_transaction = (account.balance || 0) + adjustment;

    // Update the account balance
    account.balance = balance_after_transaction;
    await account.save();

    // Create the transaction
    const newTransaction = new Transaction({
      account_id,
      amount: absAmount, // Consistent with paymentController: store absolute value
      transaction_type,
      reason,
      balance_after_transaction,
      agent_id: agent_id || undefined,
      segment_id: segment_id || undefined,
    });
    await newTransaction.save();

    res.status(201).json({
      message: "Transaction created successfully",
      transaction: newTransaction,
    });
  } catch (error) {
    res.status(500).json({ message: "Error creating transaction", error });
  }
};


// API to get all transactions
exports.getAllTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find().populate('account_id').sort({ date: -1 });
    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving transactions", error });
  }
};

// API to get all transactions for an account
exports.getTransactionsByAccount = async (req, res) => {
  try {
    const { account_id } = req.params;

    // Find all transactions for the account
    const transactions = await Transaction.find({ account_id }).populate('account_id');
    res.status(200).json(
      transactions
    );
  } catch (error) {
    res.status(500).json({ message: "Error retrieving transactions", error });
  }
};

// API to get details of a specific transaction
exports.getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the transaction by ID
    const transaction = await Transaction.findById(id).populate('account_id');
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    res.status(200).json({
      transaction,
    });
  } catch (error) {
    res.status(500).json({ message: "Error retrieving transaction", error });
  }
};

// API to update a transaction (if allowed)
exports.updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, transaction_type, reason, balance_after_transaction } = req.body;

    // Find the transaction by ID
    const transaction = await Transaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    // Update the transaction details
    transaction.amount = amount;
    transaction.transaction_type = transaction_type;
    transaction.reason = reason;
    transaction.balance_after_transaction = balance_after_transaction;

    await transaction.save();

    res.status(200).json({
      message: "Transaction updated successfully",
      transaction,
    });
  } catch (error) {
    res.status(500).json({ message: "Error updating transaction", error });
  }
};

// API to delete a transaction
exports.deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the transaction by ID
    const transaction = await Transaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    // Optionally, update the account balance - REVERTING transaction effect
    const account = await Account.findById(transaction.account_id);
    if (account) {
      if (transaction.transaction_type === "Deposit") {
        // Amount is positive. Subtract to revert.
        account.balance -= transaction.amount;
      } else if (transaction.transaction_type === "Withdrawal") {
        // Amount is negative. Subtracting total_amount (which is negative) adds it back.
        // OR: balance = balance + Math.abs(amount)
        account.balance += Math.abs(transaction.amount);
      }
      await account.save();
    }

    // Delete the transaction
    await Transaction.findByIdAndDelete(id);

    res.status(200).json({
      message: "Transaction deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ message: "Error deleting transaction", error });
  }
};
// Paginated fetching with filtering and search
exports.getTransactionsWithOptions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      transaction_type,
      start_date,
      end_date,
      search,
    } = req.query;

    const query = {};

    if (transaction_type) {
      query.transaction_type = transaction_type;
    }

    if (start_date || end_date) {
      query.transaction_date = {};
      if (start_date) query.transaction_date.$gte = new Date(start_date);
      if (end_date) query.transaction_date.$lte = new Date(end_date);
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [
        { reason: searchRegex },
        { segment_id: searchRegex },
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      populate: { path: "account_id" },
      sort: { transaction_date: -1 },
    };

    const result = await Transaction.paginate(query, options);

    res.status(200).json({
      transactions: result.docs,
      totalPages: result.totalPages,
      currentPage: result.page,
      totalRecords: result.totalDocs,
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ message: "Error fetching transactions", error: error.message });
  }
};
