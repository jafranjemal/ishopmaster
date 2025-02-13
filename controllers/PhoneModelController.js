const PhoneModel = require('../models/PhoneModel');

// Create single or multiple phone models
exports.createPhoneModels = async (req, res) => {
  try {
    // Check if the body contains an array of phone models
    const phoneModels = Array.isArray(req.body) ? req.body : [req.body];

    // Loop through the array and create each phone model
    const createdPhoneModels = await PhoneModel.insertMany(phoneModels);

    res.status(201).json({
      success: true,
      message: 'Phone models created successfully.',
      data: createdPhoneModels
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Server error while creating phone models.',
      error: err.message
    });
  }
};

// Get all phone models of a specific brand
exports.getPhoneModelsByBrand = async (req, res) => {
  try {
    const brandId = req.params.brandId;

    // Find all phone models of a given brandId
    const phoneModels = await PhoneModel.find({ brandId }).populate('brandId')

    if (!phoneModels || phoneModels.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No phone models found for this brand.'
      });
    }

    res.status(200).json({
      success: true,
      data: phoneModels
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Server error while fetching phone models.',
      error: err.message
    });
  }
};

// Get all phone models
exports.getAllPhoneModels = async (req, res) => {
  try {
    const phoneModels = await PhoneModel.find().populate('brandId')

    if (!phoneModels || phoneModels.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No phone models found.'
      });
    }

    res.status(200).json({
      success: true,
      data: phoneModels
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Server error while fetching all phone models.',
      error: err.message
    });
  }
};
