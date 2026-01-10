const express = require('express');
const router = express.Router();
const DeviceController = require('../controllers/DeviceController');

router.post('/', DeviceController.createDevice);
router.get('/', DeviceController.getAllDevices);
router.get('/check-serial/:serialNumber', DeviceController.checkSerialNumber);
router.patch('/:id/promote-serial', DeviceController.promoteDevice);
router.get('/:id', DeviceController.getDeviceById);
router.get('/customer/:customerId', DeviceController.getDevicesByCustomer);

module.exports = router;