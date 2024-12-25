const Product = require('../models/Items');

// Get all products
const getProducts = async (req, res) => {
    try {
        const products = await Product.find();
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

// Add a new product
const addProduct = async (req, res) => {
    try {
        const product = new Product(req.body);
        const savedProduct = await product.save();
        res.status(201).json(savedProduct);
    } catch (err) {
        res.status(400).json({ message: err.message });
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

module.exports = {
    getProducts,
    getProductById,
    addProduct,
    addBatchToProduct,
    calculateProfit,
};
