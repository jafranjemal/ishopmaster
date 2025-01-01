// routes/unitRoutes.js

const express = require('express');
const router = express.Router();
const unitController = require('../controllers/unitController');

// Create a new unit
router.post('/', unitController.createUnit);

// Get all units
router.get('/', unitController.getUnits);

// Get a single unit by ID
router.get('/:id', unitController.getUnitById);

// Update unit
router.put('/:id', unitController.updateUnit);

// Delete unit
router.delete('/:id', unitController.deleteUnit);

module.exports = router;
