const Product = require('../models/Items');

// Get all products
const getProducts = async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.status(200).json(products);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Get product by ID
const getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });
        res.status(200).json(product);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
const validateProductData = (data) => {
    const requiredFields = ['itemName', 'category'];
    for (const field of requiredFields) {
      if (!data[field]) {
        throw new Error(`${field} is required`);
      }
    }
  };
  
  // Add a new product
  const addProduct = async (req, res) => {
    try {
      const productData = req.body;
  
      // Validate input data
      validateProductData(productData);
  
      // Check for duplicate product
      const existingProduct = await Product.findOne({ itemName: productData.itemName });
      if (existingProduct) {
          console.log('Product with this name already exists:', existingProduct.itemName);
        return res.status(409).json({ message: 'Product with this name already exists' });
      }
  
      // Create new product
      const product = new Product(productData);
      const savedProduct = await product.save();
  
      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: savedProduct
      });
    } catch (err) {
      console.error('Error adding product:', err);
      if (err.code === 11000) {
        const duplicateField = Object.keys(err.keyPattern)[0];
        const message = `Duplicate value for ${duplicateField}: ${err.keyValue[duplicateField]}`
        console.log(message);
        return res.status(409).json({
          success: false,
          message
        });
      }

      res.status(400).json({
        success: false,
        message: err.message || 'Internal Server Error'
      });
    }
  };

// Add a batch to a product
const addBatchToProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });

        const batchDetails = req.body;
        product.batches.push({
            ...batchDetails,
            batchId: new mongoose.Types.ObjectId(), // Generate unique batch ID
            remainingUnits: batchDetails.units,
        });

        product.currentStock += batchDetails.units;
        await product.save();
        res.status(200).json(product);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Calculate profit for a product
const calculateProfit = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });

        let totalProfit = 0;

        product.batches.forEach((batch) => {
            const soldUnits = batch.units - batch.remainingUnits;
            const profitPerUnit = batch.sellingPrice - batch.purchasePrice;
            totalProfit += soldUnits * profitPerUnit;
        });

        res.status(200).json({ totalProfit });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Edit an existing product
const editProduct = async (req, res) => {
    try {
      const { id } = req.params;
      const productData = req.body;
  
      // Validate input data
      validateProductData(productData);
  
      const updatedProduct = await Product.findByIdAndUpdate(id, productData, { new: true });
      if (!updatedProduct) {
        return res.status(404).json({ message: 'Product not found' });
      }
  
      res.status(200).json({
        success: true,
        message: 'Product updated successfully',
        data: updatedProduct
      });
    } catch (err) {
      console.error('Error updating product:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Internal Server Error'
      });
    }
  };

// Delete an existing product
const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedProduct = await Product.findByIdAndDelete(id);
        if (!deletedProduct) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.status(200).json({ message: 'Product deleted successfully' });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};


module.exports = {
    editProduct,
    deleteProduct,
    getProducts,
    getProductById,
    addProduct,
    addBatchToProduct,
    calculateProfit,
};
