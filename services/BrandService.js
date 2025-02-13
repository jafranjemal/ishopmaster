const Brand = require('../models/Brand');

async function createBrand(data) {
  try {
    if (Array.isArray(data)) {
      // If data is an array, insert many brands
      const brands = await Brand.insertMany(data);
      return brands;
    } else if (typeof data === 'object') {
      // If data is a single object, create one brand
      const brand = new Brand(data);
      await brand.save();
      return brand;
    } else {
      throw new Error('Data must be an array or an object');
    }
  } catch (error) {
    throw new Error(`Error creating brand(s): ${error.message}`);
  }
}

async function getAllBrands() {
  try {
    const brands = await Brand.find();
    return brands;
  } catch (error) {
    throw new Error('Error fetching brands');
  }
}

module.exports = {
  createBrand,
  getAllBrands
};
