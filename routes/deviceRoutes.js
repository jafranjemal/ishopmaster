const express = require('express');
const router = express.Router();
const DeviceController = require('../controllers/DeviceController');

router.post('/', DeviceController.createDevice);
router.get('/', DeviceController.getAllDevices);
router.get('/check-serial/:serialNumber', DeviceController.checkSerialNumber);
router.get('/:id', DeviceController.getDeviceById);

module.exports = router;