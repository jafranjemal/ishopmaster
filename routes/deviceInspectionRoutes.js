const express = require('express');
const router = express.Router();
const DeviceInspectionController = require('../controllers/DeviceInspectionController');

router.post('/', DeviceInspectionController.createDeviceInspection);
router.get('/', DeviceInspectionController.getAllDeviceInspections);
router.get('/:id', DeviceInspectionController.getDeviceInspectionById);
router.put('/:id', DeviceInspectionController.updateDeviceInspection);
router.delete('/:id', DeviceInspectionController.deleteDeviceInspection);

module.exports = router;