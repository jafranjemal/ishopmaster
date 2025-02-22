const express = require('express');
const router = express.Router();
const DeviceController = require('../controllers/DeviceController');

router.post('/', DeviceController.createDevice);
router.get('/', DeviceController.getAllDevices);
router.get('/:id', DeviceController.getDeviceById);
router.put('/:id', DeviceController.updateDevice);
router.delete('/:id', DeviceController.deleteDevice);
router.get('/check-serial/:serialNumber', DeviceController.checkSerialNumber);

module.exports = router;