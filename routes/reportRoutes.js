const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reports/reportController');
const { protect } = require('../middleware/auth');

router.get('/owner-flash', protect, reportController.getOwnerFlash);
router.get('/profit-loss', protect, reportController.getProfitLoss);
router.get('/customer-intelligence', protect, reportController.getCustomerIntelligence);
router.get('/supplier-intelligence', protect, reportController.getSupplierIntelligence);
router.get('/stock-valuation', protect, reportController.getStockValuation);
router.get('/service-vs-retail', protect, reportController.getServiceVsRetail);
router.get('/forecasting', protect, reportController.getForecasting);
router.get('/comprehensive-audit', protect, reportController.getComprehensiveAudit);

module.exports = router;
