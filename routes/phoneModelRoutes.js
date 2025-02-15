const express = require('express');
const router = express.Router();
const PhoneModelController = require('../controllers/PhoneModelController');

// Create single or multiple phone models
router.post('/', PhoneModelController.createPhoneModels);

// Get all phone models of a specific brand
router.get('/brand/:brandId', PhoneModelController.getPhoneModelsByBrand);

// Get all phone models
router.get('/', PhoneModelController.getAllPhoneModels);

// Get a single phone model
router.get('/:phoneModelId', PhoneModelController.getPhoneModel);

// Update a single phone model
router.put('/:phoneModelId', PhoneModelController.updatePhoneModel);

// Delete a single phone model
router.delete('/:phoneModelId', PhoneModelController.deletePhoneModel);

// Delete multiple phone models
router.delete('/', PhoneModelController.deletePhoneModels);

// Get phone models by specific criteria
//router.get('/criteria', PhoneModelController.getPhoneModelsByCriteria);

// Bulk update phone models
//router.put('/bulk', PhoneModelController.bulkUpdatePhoneModels);

// Get phone models with pagination
//router.get('/pagination', PhoneModelController.getPhoneModelsWithPagination);

// Search phone models by name
//router.get('/search', PhoneModelController.searchPhoneModelsByName);

module.exports = router;