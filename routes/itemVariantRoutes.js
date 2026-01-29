const express = require('express');
const router = express.Router();
const {
    getVariantsByItem,
    createVariant,
    updateVariant,
    deleteVariant,
    checkDuplicateVariant,
    createDefaultVariant
} = require('../controllers/itemVariantController');

// Routes
router.get('/item/:itemId', getVariantsByItem); // Get variants for a specific base item
router.get('/check-name', checkDuplicateVariant); // Check for duplicate variant name
router.post('/default', createDefaultVariant); // Create default variant (No params needed if body has itemId)
router.post('/', createVariant); // Create new variant
router.put('/:id', updateVariant); // Update variant
router.delete('/:id', deleteVariant); // Delete variant

module.exports = router;
