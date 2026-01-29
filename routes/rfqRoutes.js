const express = require('express');
const router = express.Router();
const rfqController = require('../controllers/rfqController');

// Routes for /api/rfq
router.get('/', rfqController.getAllRFQs);
router.post('/', rfqController.createRFQ);
router.put('/:id', rfqController.updateRFQ);
router.delete('/:id', rfqController.deleteRFQ);
router.patch('/:id/status', rfqController.updateStatus);

module.exports = router;
