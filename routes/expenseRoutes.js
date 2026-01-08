const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const profitLossController = require('../controllers/profitLossController');
const { authenticate } = require('../middleware/auth');

// Expense CRUD
router.post('/', authenticate, expenseController.createExpense);
router.get('/', authenticate, expenseController.getExpenses);
router.get('/category-summary', authenticate, expenseController.getCategorySummary);
router.get('/:id', authenticate, expenseController.getExpenseById);
router.put('/:id', authenticate, expenseController.updateExpense);
router.delete('/:id', authenticate, expenseController.deleteExpense);

// P&L Reports
router.get('/reports/profit-loss', authenticate, profitLossController.getProfitLossStatement);
router.get('/reports/profit-loss/compare', authenticate, profitLossController.compareProfitLoss);

module.exports = router;
