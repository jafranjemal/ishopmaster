const express = require('express');
const router = express.Router();
const salesInvoiceController = require('../controllers/salesInvoiceController');

// Create a new sales invoice
router.post('/', salesInvoiceController.createSalesInvoice);

// Get all sales invoices
router.get('/', salesInvoiceController.getAllSalesInvoices);

// Get a single sales invoice by ID
router.get('/:id', salesInvoiceController.getSalesInvoiceById);

// Update a sales invoice
router.put('/:id', salesInvoiceController.updateSalesInvoice);

// Process payment for a sales invoice
router.post('/:id/pay', salesInvoiceController.processPayment);

// Professional return flow
router.post('/:id/return', salesInvoiceController.processReturn);

router.delete('/:id', salesInvoiceController.deleteInvoice);

module.exports = router;