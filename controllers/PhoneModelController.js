 
const { default: mongoose } = require('mongoose');
const PhoneModel = require('../models/PhoneModel');


// Create single or multiple phone models
exports.createPhoneModels = async (req, res) => {
    try {
      // Check if the body contains an array of phone models
      const phoneModels = Array.isArray(req.body) ? req.body : [req.body];
  
      // Check for duplicate names
         // Check for duplicate phone models
    const duplicateModels = [];
    for (const phoneModelData of phoneModels) {
      const existingPhoneModel = await PhoneModel.findOne({
        brandId: phoneModelData.brandId,
        model_name: phoneModelData.model_name
      });

      if (existingPhoneModel) {
        duplicateModels.push(`${phoneModelData.model_name} (Brand ID: ${phoneModelData.brandId})`);
      }
    }

    if (duplicateModels.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Phone models with the following brand and model names already exist: ' + duplicateModels.join(', '),
        error: 'Duplicate entries found'
      });
    }
  
      // Loop through the array and create each phone model
      const createdPhoneModels = await PhoneModel.insertMany(phoneModels);
  
      res.status(201).json({
        success: true,
        message: 'Phone models created successfully.',
        data: createdPhoneModels
      });
    } catch (err) {
      console.log(err);
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
    const phoneModels = await PhoneModel.find().populate('brandId').sort({ _id: -1 });

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

// Get a single phone model
exports.getPhoneModel = async (req, res) => {
  try {
    const phoneModelId = req.params.phoneModelId;

    // Find a single phone model by id
    const phoneModel = await PhoneModel.findById(phoneModelId).populate('brandId')

    if (!phoneModel) {
      return res.status(404).json({
        success: false,
        message: 'Phone model not found.'
      });
    }

    res.status(200).json({
      success: true,
      data: phoneModel
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Server error while fetching phone model.',
      error: err.message
    });
  }
};

// Update a single phone model
exports.updatePhoneModel = async (req, res) => {
  try {
    const phoneModelId = req.params.phoneModelId;

    // Find and update a single phone model by id
    const updatedPhoneModel = await PhoneModel.findByIdAndUpdate(phoneModelId, req.body, { new: true }).populate('brandId')

    if (!updatedPhoneModel) {
      return res.status(404).json({
        success: false,
        message: 'Phone model not found.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Phone model updated successfully.',
      data: updatedPhoneModel
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Server error while updating phone model.',
      error: err.message
    });
  }
};

// Delete a single phone model
exports.deletePhoneModel = async (req, res) => {
    try {
      const phoneModelId = req.params.phoneModelId;
  
      // Validate phoneModelId
      if (!mongoose.Types.ObjectId.isValid(phoneModelId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid phone model ID.'
        });
      }
  
      // Find and delete a single phone model by id
      const deletedPhoneModel = await PhoneModel.findByIdAndDelete(phoneModelId);
  
      if (!deletedPhoneModel) {
        return res.status(404).json({
          success: false,
          message: 'Phone model not found.'
        });
      }
  
      res.status(200).json({
        success: true,
        message: 'Phone model deleted successfully.',
        data: deletedPhoneModel
      });
    } catch (err) {
      console.error('Error deleting phone model:', err);
      res.status(500).json({
        success: false,
        message: 'Server error while deleting phone model.',
        error: err.message
      });
    }
  };

// Delete multiple phone models
exports.deletePhoneModels = async (req, res) => {
  try {
    const phoneModelIds = req.body.ids; // Expecting an array of IDs

    // Find and delete multiple phone models by IDs
    const deletedPhoneModels = await PhoneModel.deleteMany({ _id: { $in: phoneModelIds } });

    if (deletedPhoneModels.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'No phone models found to delete.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Phone models deleted successfully.',
      data: deletedPhoneModels
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Server error while deleting phone models.',
      error: err.message
    });
  }
};
 
// Get phone models by specific criteria
exports.getPhoneModelsByCriteria = async (req, res) => {
  try {
    const criteria = req.query; // Expecting query parameters for filtering

    // Find phone models based on criteria
    const phoneModels = await PhoneModel.find(criteria).populate('brandId');

    if (!phoneModels || phoneModels.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No phone models found matching the criteria.'
      });
    }

    res.status(200).json({
      success: true,
      data: phoneModels
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Server error while fetching phone models by criteria.',
      error: err.message
    });
  }
};

// Bulk update phone models
exports.bulkUpdatePhoneModels = async (req, res) => {
  try {
    const updates = req.body; // Expecting an array of updates

    const updatePromises = updates.map(update => 
      PhoneModel.findByIdAndUpdate(update.id, update.data, { new: true }).populate('brandId')
    );

    const updatedPhoneModels = await Promise.all(updatePromises);

    res.status(200).json({
      success: true,
      message: 'Phone models updated successfully.',
      data: updatedPhoneModels
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Server error while bulk updating phone models.',
      error: err.message
    });
  }
};
 
// Get phone models with pagination
exports.getPhoneModelsWithPagination = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query; // Default to page 1 and limit 10
    const skip = (page - 1) * limit;

    const phoneModels = await PhoneModel.find().populate('brandId').skip(skip).limit(limit);

    const total = await PhoneModel.countDocuments();

    res.status(200).json({
      success: true,
      data: phoneModels,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Server error while fetching phone models with pagination.',
      error: err.message
    });
  }
};

// Search phone models by name
exports.searchPhoneModelsByName = async (req, res) => {
  try {
    const { name } = req.query; // Expecting a name query parameter

    const phoneModels = await PhoneModel.find({ name: new RegExp(name, 'i') }).populate('brandId');

    if (!phoneModels || phoneModels.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No phone models found matching the name.'
      });
    }

    res.status(200).json({
      success: true,
      data: phoneModels
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Server error while searching phone models by name.',
      error: err.message
    });
  }
};
 