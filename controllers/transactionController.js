const Transaction = require("../models/Transaction");
const Account = require("../models/Account");

const mongoose = require('mongoose');

exports.createTransaction = async (req, res) => {
    try {
      const { account_id, amount, transaction_type, reason } = req.body;
  
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
  
      // Calculate balance after transaction
      let balance_after_transaction;
      if (transaction_type === "Deposit") {
        balance_after_transaction = account.balance + amount;
      } else if (transaction_type === "Withdrawal") {
        
        if (account.account_owner_type !== "Supplier" && account.balance < amount) {  // Deposit and Withdrawal can be any amount for Suppliers
          return res.status(400).json({ message: "Insufficient balance for withdrawal" });
        }
        balance_after_transaction = account.balance - amount;
      }
  
      // Update the account balance
      account.balance = balance_after_transaction;
      await account.save();
  
      // Create the transaction
      const newTransaction = new Transaction({
        account_id,
        amount : transaction_type === "Withdrawal" ? amount *-1 : amount,
        transaction_type,
        reason,
        balance_after_transaction,
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
  

// exports.createTransaction = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const { account_id, amount, transaction_type, reason } = req.body;

//     // Validate input fields
//     if (!account_id || !amount || !transaction_type || !reason) {
//       return res.status(400).json({ message: "All fields are required" });
//     }

//     if (amount <= 0) {
//       return res.status(400).json({ message: "Amount must be positive" });
//     }

//     if (!["Deposit", "Withdrawal"].includes(transaction_type)) {
//       return res.status(400).json({ message: "Invalid transaction type" });
//     }

//     // Fetch the account and validate
//     const account = await Account.findById(account_id).session(session);
//     if (!account) {
//       return res.status(404).json({ message: "Account not found" });
//     }

//     // Calculate balance after transaction
//     let balance_after_transaction;
//     if (transaction_type === "Deposit") {
//       balance_after_transaction = account.balance + amount;
//     } else if (transaction_type === "Withdrawal") {
//       if (account.balance < amount) {
//         return res.status(400).json({ message: "Insufficient balance for withdrawal" });
//       }
//       balance_after_transaction = account.balance - amount;
//     }

//     // Create the transaction
//     const newTransaction = new Transaction({
//       account_id,
//       amount,
//       transaction_type,
//       reason,
//       balance_after_transaction,
//     });

//     await newTransaction.save({ session });

//     // Update the account balance
//     account.balance = balance_after_transaction;
//     await account.save({ session });

//     // Commit transaction
//     await session.commitTransaction();
//     session.endSession();

//     res.status(201).json({
//       message: "Transaction created successfully",
//       transaction: newTransaction,
//     });
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     res.status(500).json({ message: "Error creating transaction", error });
//   }
// };

// API to create a new transaction
// exports.createTransaction = async (req, res) => {
//   try {
//     const { account_id, amount, transaction_type, reason } = req.body;

//     // Check if the account exists
//     const account = await Account.findById(account_id);
//     if (!account) {
//       return res.status(404).json({ message: "Account not found" });
//     }

//     // Create the transaction
//     const newTransaction = new Transaction({
//       account_id,
//       amount,
//       transaction_type,
//       reason,
//       balance_after_transaction,
//     });

//     await newTransaction.save();

//     // Update the account's balance after the transaction
//     let updatedBalance = 0;
//     if (transaction_type === "Deposit") {
//       updatedBalance = account.balance + amount;
//     } else if (transaction_type === "Withdrawal") {
//       updatedBalance = account.balance - amount;
//     }

//     account.balance = updatedBalance;
//     await account.save();

//     res.status(201).json({
//       message: "Transaction created successfully",
//       transaction: newTransaction,
//     });
//   } catch (error) {
//     res.status(500).json({ message: "Error creating transaction", error });
//   }
// };

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

// API to update a transaction (e.g., for editing a withdrawal/deposit)
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

    // Delete the transaction
    await transaction.remove();

    // Optionally, update the account balance
    const account = await Account.findById(transaction.account_id);
    if (transaction.transaction_type === "Deposit") {
      account.balance -= transaction.amount;
    } else if (transaction.transaction_type === "Withdrawal") {
      account.balance += transaction.amount;
    }
    await account.save();

    res.status(200).json({
      message: "Transaction deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ message: "Error deleting transaction", error });
  }
};
