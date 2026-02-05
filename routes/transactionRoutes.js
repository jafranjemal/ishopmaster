const express = require("express");
const router = express.Router();
const transactionController = require("../controllers/transactionController");

// Create a new transaction (deposit/withdrawal)
router.post("/", transactionController.createTransaction);

// Get all transactions
router.get("/", transactionController.getAllTransactions);

// Paginated transactions
router.get("/paginated", transactionController.getTransactionsWithOptions);

// Get all transactions for a specific account
router.get("/account/:account_id", transactionController.getTransactionsByAccount);

// Get details of a specific transaction by its ID
router.get("/:id", transactionController.getTransactionById);

// Update a transaction (if allowed)
router.put("/:id", transactionController.updateTransaction);

// Delete a transaction
router.delete("/:id", transactionController.deleteTransaction);

module.exports = router;
