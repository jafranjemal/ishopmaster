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
} = require('../controllers/productController');

// Routes
router.get('/', getProducts); // Get all products
router.get('/:id', getProductById); // Get product by ID
router.post('/', addProduct); // Add a new product
router.put('/:id', editProduct); // edit product
router.delete('/:id', deleteProduct); // edit product
router.post('/:id/batches', addBatchToProduct); // Add a batch to a product
router.get('/:id/profit', calculateProfit); // Calculate profit for a product

module.exports = router;
