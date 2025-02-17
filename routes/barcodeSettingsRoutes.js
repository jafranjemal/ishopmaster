const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/barcodeSettingsController');

// Save settings
router.post('/', settingsController.saveSettings);

// Update settings
router.put('/:id', settingsController.updateSettings);

// Delete settings
router.delete('/:id', settingsController.deleteSettings);

// Get all settings
router.get('/', settingsController.getAllSettings);

// Get settings by ID
router.get('/:id', settingsController.getSettingsById);

 

module.exports = router;