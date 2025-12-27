const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');

// Route to create new stock entry
router.post('/', stockController.createStock);
router.post('/adjust', stockController.adjustStock);


// Route to update stock after sale
router.put('/sale', stockController.updateStockOnSale);

// Route to get total current stock value (unit cost * available qty)
router.get('/current-stock-value', stockController.getCurrentStockValue);

// Route to get stock by batch number for item
// Aggregates stock details for multiple items, showing summaries and batch-level details
router.get('/batch/:item_id/:batch_number', stockController.getStockByBatch);

router.get('/items-with-stock', stockController.getAllItemsWithStock);
router.get('/items-with-unified-stock', stockController.getUnifiedStock);
router.get('/movement-dashboard', stockController.getStockMovementDashboardData);


// Route to get stock details for a specific item 
//Provides a detailed view of all batches for a single item

// Route to get all stocks for an item
router.get('/item/:itemId', stockController.getItemStockDetails);
router.get("/items/:itemId", stockController.getItemStockOverview);
router.get("/items/:itemId/sales-history", stockController.getItemSalesHistory);


router.get('/purchase/:purchaseId', stockController.getStockByPurchaseId);
router.post("/backfill-ledger", stockController.backfillLedger);

module.exports = router;
