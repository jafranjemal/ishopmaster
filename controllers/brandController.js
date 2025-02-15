const Brand = require("../models/Brand");
const brandService = require('../services/BrandService');
// Create a new brand
exports.createBrand = async (req, res) => {
  try {
    const brandData = req.body;
    const createdBrand = await brandService.createBrand(brandData);
    res.status(201).json({
      success: true,
      message: 'Brand(s) created successfully',
      data: createdBrand
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get all brands
exports.getBrands = async (req, res) => {
  try {
    const brands = await Brand.find().sort({ _id: -1 });
    res.status(200).json({ success: true, data: brands });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get a single brand by ID
exports.getBrandById = async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand) return res.status(404).json({ success: false, message: "Brand not found" });
    res.status(200).json({ success: true, data: brand });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update a brand
exports.updateBrand = async (req, res) => {
  try {
    const { name, description, image } = req.body;
    console.log(req.params.id)
    console.log(req.body)
    const brand = await Brand.findByIdAndUpdate(
      req.params.id,
      { name, description, image, updated_at: Date.now() },
      { new: true }
    );
    if (!brand) return res.status(404).json({ success: false, message: "Brand not found" });
    console.log({brand})
    res.status(200).json({ success: true, message: "Brand updated successfully", data: brand });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete a brand
exports.deleteBrand = async (req, res) => {
  try {
    const brand = await Brand.findByIdAndDelete(req.params.id);
    if (!brand) return res.status(404).json({ success: false, message: "Brand not found" });
    res.status(200).json({ success: true, message: "Brand deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
