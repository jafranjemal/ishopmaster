const express = require('express');
const router = express.Router();
const {
    getProducts,
    getProductById,
    addProduct,
    addBatchToProduct,
    calculateProfit,
    editProduct,
    deleteProduct,
    checkItemName,
    checkBarcode,
} = require('../controllers/productController');

const { posSearch } = require('../controllers/inventorySearchController');

// Routes
router.get('/pos-search', posSearch); // Dedicated POS Search
router.get('/', getProducts); // Get all products
router.get('/check-name', checkItemName); // Check for duplicate names
router.get('/check-barcode', checkBarcode); // Check for duplicate barcodes/SKUs
router.get('/:id', getProductById); // Get product by ID
router.post('/', addProduct); // Add a new product
router.put('/:id', editProduct); // edit product
router.delete('/:id', deleteProduct); // edit product
router.post('/:id/batches', addBatchToProduct); // Add a batch to a product
router.get('/:id/profit', calculateProfit); // Calculate profit for a product
router.get('/:id/analytics', require('../controllers/productController').getItemAnalytics); // Item Intelligence API

module.exports = router;
