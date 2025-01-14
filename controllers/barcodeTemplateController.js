const BarcodeTemplate = require("../models/BarcodeTemplate");

// Create a new barcode template
exports.createTemplate = async (req, res) => {
  try {
    const template = new BarcodeTemplate(req.body);
    await template.save();
    res.status(201).json({ success: true, message: "Barcode template created successfully!", template });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error creating barcode template", error });
  }
};

// Get all barcode templates
exports.getTemplates = async (req, res) => {
  try {
    const templates = await BarcodeTemplate.find();
    res.status(200).json({ success: true, templates });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching barcode templates", error });
  }
};

// Get a single barcode template by ID
exports.getTemplateById = async (req, res) => {
  try {
    const template = await BarcodeTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: "Barcode template not found" });
    }
    res.status(200).json({ success: true, template });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching barcode template", error });
  }
};

// Update a barcode template
exports.updateTemplate = async (req, res) => {
  try {
    const template = await BarcodeTemplate.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!template) {
      return res.status(404).json({ success: false, message: "Barcode template not found" });
    }
    res.status(200).json({ success: true, message: "Barcode template updated successfully!", template });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error updating barcode template", error });
  }
};

// Delete a barcode template
exports.deleteTemplate = async (req, res) => {
  try {
    const template = await BarcodeTemplate.findByIdAndDelete(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: "Barcode template not found" });
    }
    res.status(200).json({ success: true, message: "Barcode template deleted successfully!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deleting barcode template", error });
  }
};
