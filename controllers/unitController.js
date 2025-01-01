// controllers/unitController.js

const Unit = require('../models/Unit');

// Create a new unit or bulk save
exports.createUnit = async (req, res) => {
    try {
      const isArray = Array.isArray(req.body);
      
      if (isArray) {
        // Bulk save
        const newUnits = await Unit.insertMany(req.body);
        res.status(201).json(newUnits);
      } else {
        // Single save
        const { name, description, symbol } = req.body;
        if (name) {
          const newUnit = new Unit({ name, description, symbol });
          await newUnit.save();
          res.status(201).json(newUnit);
        } else {
          res.status(400).json({ message: "Invalid input for single save" });
        }
      }
    } catch (error) {
      res.status(500).json({ message: "Error creating unit", error });
    }
  };
  

// Get all units
exports.getUnits = async (req, res) => {
  try {
    const units = await Unit.find();
    res.status(200).json(units);
  } catch (error) {
    res.status(500).json({ message: "Error fetching units", error });
  }
};

// Get a single unit by ID
exports.getUnitById = async (req, res) => {
  try {
    const unit = await Unit.findById(req.params.id);
    if (!unit) {
      return res.status(404).json({ message: "Unit not found" });
    }
    res.status(200).json(unit);
  } catch (error) {
    res.status(500).json({ message: "Error fetching unit", error });
  }
};

// Update unit
exports.updateUnit = async (req, res) => {
  try {
    const updatedUnit = await Unit.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedUnit) {
      return res.status(404).json({ message: "Unit not found" });
    }
    res.status(200).json(updatedUnit);
  } catch (error) {
    res.status(500).json({ message: "Error updating unit", error });
  }
};

// Delete unit
exports.deleteUnit = async (req, res) => {
  try {
    const deletedUnit = await Unit.findByIdAndDelete(req.params.id);
    if (!deletedUnit) {
      return res.status(404).json({ message: "Unit not found" });
    }
    res.status(200).json({ message: "Unit deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting unit", error });
  }
};
