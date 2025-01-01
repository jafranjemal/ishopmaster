const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');

// Route to create new stock entry
router.post('/', stockController.createStock);

// Route to get all stocks for an item
router.get('/item/:item_id', stockController.getStockByItem);

// Route to update stock after sale
router.put('sale', stockController.updateStockOnSale);

// Route to get total current stock value (unit cost * available qty)
router.get('current-stock-value', stockController.getCurrentStockValue);

// Route to get stock by batch number for item
// Aggregates stock details for multiple items, showing summaries and batch-level details
router.get('/batch/:item_id/:batch_number', stockController.getStockByBatch);

router.get('/items-with-stock', stockController.getAllItemsWithStock);


// Route to get stock details for a specific item 
//Provides a detailed view of all batches for a single item
router.get('/item/:item_id/stock', stockController.getStockForItem);


router.get('/purchase/:purchaseId', stockController.getStockByPurchaseId);

module.exports = router;
