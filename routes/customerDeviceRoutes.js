const express = require('express');
const router = express.Router();
const controller = require('../controllers/customerDeviceController');

// Get device by ID
router.get('/:id', controller.getById);

// Check if device exists by serial number
router.get('/check-serial/:serial', controller.checkSerial);

// Get all devices for a customer
router.get('/by-customer/:customerId', controller.getByCustomer);

// Create new device
router.post('/', controller.create);

// Update device status
router.patch('/:id/status', controller.updateStatus);

module.exports = router;
