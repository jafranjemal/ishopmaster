const express = require('express');
const router = express.Router();
const PhoneModelController = require('../controllers/PhoneModelController');

// Route to create phone models (single or bulk)
router.post('/', PhoneModelController.createPhoneModels);

// Route to get phone models by brand
router.get('/brand/:brandId', PhoneModelController.getPhoneModelsByBrand);

// Route to get all phone models
router.get('/', PhoneModelController.getAllPhoneModels);

module.exports = router;
