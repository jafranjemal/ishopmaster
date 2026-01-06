const express = require('express');
const router = express.Router();
const {
    getVariantsByItem,
    createVariant,
    updateVariant,
    deleteVariant,
    checkDuplicateVariant
} = require('../controllers/itemVariantController');

// Routes
router.get('/item/:itemId', getVariantsByItem); // Get variants for a specific base item
router.get('/check-name', checkDuplicateVariant); // Check for duplicate variant name
router.post('/', createVariant); // Create new variant
router.put('/:id', updateVariant); // Update variant
router.delete('/:id', deleteVariant); // Delete variant

module.exports = router;
