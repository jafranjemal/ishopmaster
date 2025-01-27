// shiftRoutes.js
const express = require('express');
const router = express.Router();
const shiftController = require('../controllers/shiftController');

router.post('/', shiftController.createShift);
router.post('/:id/close', shiftController.closeShift);
router.get('/', shiftController.getShifts);
router.put('/:id', shiftController.updateShift);
router.delete('/:id', shiftController.deleteShift);
router.get('/today/:userId', shiftController.checkTodayShift);
router.get('/:userId/current-shift', shiftController.getCurrentShift);
router.patch('/:shiftId/cash', shiftController.updateShiftCash);
module.exports = router;