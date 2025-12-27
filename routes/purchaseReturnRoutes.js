const express = require('express');
const router = express.Router();
const purchaseReturnController = require('../controllers/purchaseReturnController');
const { authenticate } = require('../middleware/auth');
 
// All routes require authentication
router.use(authenticate);

// Validate return eligibility
router.post('/validate', purchaseReturnController.validateReturn);

// Create new purchase return
router.post('/', purchaseReturnController.createPurchaseReturn);

// Get all purchase returns (with filters)
router.get('/', purchaseReturnController.getPurchaseReturns);

// Get single purchase return by ID
router.get('/:id', purchaseReturnController.getPurchaseReturnById);

// Approve purchase return
router.put('/:id/approve', purchaseReturnController.approvePurchaseReturn);

// Reject purchase return
router.put('/:id/reject', purchaseReturnController.rejectPurchaseReturn);

module.exports = router;
