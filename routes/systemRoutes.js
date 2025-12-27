const express = require('express');
const router = express.Router();
const systemController = require('../controllers/systemController');

/**
 * @route   GET /api/system/status
 * @desc    Check if system needs first-time setup
 * @access  Public
 */
router.get('/status', systemController.getSystemStatus);

/**
 * @route   POST /api/system/initialize
 * @desc    Initialize system with company, admin, and defaults
 * @access  Public (only works when no company exists)
 */
router.post('/initialize', systemController.initializeSystem);

/**
 * @route   GET /api/system/info
 * @desc    Get system information (company details, version)
 * @access  Public
 */
router.get('/info', systemController.getSystemInfo);

module.exports = router;
