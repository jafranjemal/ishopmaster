const express = require('express');
const router = express.Router();
const DeviceInspectionController = require('../controllers/DeviceInspectionController');

// Create a new device inspection
router.post('/', DeviceInspectionController.createInspection);

// Get all inspections
router.get('/', DeviceInspectionController.getAllInspections);

// Get inspection by ID
router.get('/:id', DeviceInspectionController.getInspectionById);

// Update inspection
router.put('/:id', DeviceInspectionController.updateInspection);

// Delete inspection
router.delete('/:id', DeviceInspectionController.deleteInspection);

// Get inspections by Customer ID
router.get('/customer/:customerId', DeviceInspectionController.getInspectionsByCustomer);

module.exports = router;