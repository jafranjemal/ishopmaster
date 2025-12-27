const Item = require('../models/Items');
const Stock = require('../models/Stock');
const SerializedStock = require('../models/SerializedStock');
const NonSerializedStock = require('../models/NonSerializedStock');
const mongoose = require('mongoose');

// Get all products with pagination, filtering, and sorting
const getProducts = async (req, res) => {
  try {
    // Extract pagination params
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Extract search and filter params
    const search = req.query.search || '';
    const category = req.query.category || '';
    const manufacturer = req.query.manufacturer || '';
    const modelName = req.query.modelName || '';
    const barcode = req.query.barcode || '';
    const itemName = req.query.itemName || '';
    const itemDescription = req.query.itemDescription || '';

    // Extract sort params
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;

    // Build filter query
    let filter = {};

    // Global search across multiple fields
    if (search) {
      filter.$or = [
        { itemName: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { manufacturer: { $regex: search, $options: 'i' } },
        { modelName: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } },
        { itemDescription: { $regex: search, $options: 'i' } }
      ];
    }

    // Individual field filters
    if (category) filter.category = { $regex: category, $options: 'i' };
    if (manufacturer) filter.manufacturer = { $regex: manufacturer, $options: 'i' };
    if (modelName) filter.modelName = { $regex: modelName, $options: 'i' };
    if (barcode) filter.barcode = { $regex: barcode, $options: 'i' };
    if (itemName) filter.itemName = { $regex: itemName, $options: 'i' };
    if (itemDescription) filter.itemDescription = { $regex: itemDescription, $options: 'i' };

    // Count total documents for pagination
    const total = await Item.countDocuments(filter);

    // Fetch paginated data with stock aggregation using Pipeline
    const products = await Item.aggregate([
      { $match: filter },
      { $sort: { [sortBy]: sortOrder } },
      { $skip: skip },
      { $limit: limit },
      // Lookup 1: Total from 'stocks' collection (Legacy/General)
      {
        $lookup: {
          from: 'stocks',
          let: { itemId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$item_id', '$$itemId'] } } },
            { $group: { _id: null, total: { $sum: '$available_qty' } } }
          ],
          as: 'stockData'
        }
      },
      // Lookup 2: Total from 'nonserializedstocks' collection
      {
        $lookup: {
          from: 'nonserializedstocks',
          let: { itemId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$item_id', '$$itemId'] } } },
            { $group: { _id: null, total: { $sum: '$availableQty' } } }
          ],
          as: 'nonSerializedStockData'
        }
      },
      // Lookup 3: Total from 'serializedstocks' collection (Status: Available)
      {
        $lookup: {
          from: 'serializedstocks',
          let: { itemId: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$item_id', '$$itemId'] }, { $eq: ['$status', 'Available'] }] } } },
            { $count: 'total' }
          ],
          as: 'serializedStockData'
        }
      },
      // Calculate final totalStock from all sources
      {
        $addFields: {
          totalStock: {
            $add: [
              { $ifNull: [{ $arrayElemAt: ['$stockData.total', 0] }, 0] },
              { $ifNull: [{ $arrayElemAt: ['$nonSerializedStockData.total', 0] }, 0] },
              { $ifNull: [{ $arrayElemAt: ['$serializedStockData.total', 0] }, 0] }
            ]
          }
        }
      }
    ]);

    // Return standardized paginated response
    res.status(200).json({
      message: "Products retrieved successfully",
      data: products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get product by ID with aggregated stock
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const products = await Item.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      // Lookup 1: Total from 'stocks' collection
      {
        $lookup: {
          from: 'stocks',
          let: { itemId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$item_id', '$$itemId'] } } },
            { $group: { _id: null, total: { $sum: '$available_qty' } } }
          ],
          as: 'stockData'
        }
      },
      // Lookup 2: Total from 'nonserializedstocks' collection
      {
        $lookup: {
          from: 'nonserializedstocks',
          let: { itemId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$item_id', '$$itemId'] } } },
            { $group: { _id: null, total: { $sum: '$availableQty' } } }
          ],
          as: 'nonSerializedStockData'
        }
      },
      // Lookup 3: Total from 'serializedstocks' collection (Status: Available)
      {
        $lookup: {
          from: 'serializedstocks',
          let: { itemId: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$item_id', '$$itemId'] }, { $eq: ['$status', 'Available'] }] } } },
            { $count: 'total' }
          ],
          as: 'serializedStockData'
        }
      },
      {
        $addFields: {
          totalStock: {
            $add: [
              { $ifNull: [{ $arrayElemAt: ['$stockData.total', 0] }, 0] },
              { $ifNull: [{ $arrayElemAt: ['$nonSerializedStockData.total', 0] }, 0] },
              { $ifNull: [{ $arrayElemAt: ['$serializedStockData.total', 0] }, 0] }
            ]
          }
        }
      }
    ]);

    if (!products || products.length === 0) return res.status(404).json({ message: 'Product not found' });
    res.status(200).json(products[0]);
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
    const existingProduct = await Item.findOne({ itemName: productData.itemName });
    if (existingProduct) {
      console.log('Product with this name already exists:', existingProduct.itemName);
      return res.status(409).json({ message: 'Product with this name already exists' });
    }

    // Create new product
    const product = new Item(productData);
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
    const product = await Item.findById(req.params.id);
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
    const product = await Item.findById(req.params.id);
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
    const productId = req.params.id;
    const beforeUpdate = await Item.findById(productId);

    if (!beforeUpdate) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const updatedProduct = await Item.findByIdAndUpdate(productId, req.body, {
      new: true,
    });

    // Price Change Black Box: Log sensitive changes
    if (beforeUpdate.sellingPrice !== updatedProduct.sellingPrice ||
      beforeUpdate.lastSellingPrice !== updatedProduct.lastSellingPrice) {

      const AuditLog = require('../models/AuditLog');
      await AuditLog.create({
        action: 'PRICE_CHANGE',
        performedBy: req.user?._id,
        before: {
          sellingPrice: beforeUpdate.sellingPrice,
          lastSellingPrice: beforeUpdate.lastSellingPrice
        },
        after: {
          sellingPrice: updatedProduct.sellingPrice,
          lastSellingPrice: updatedProduct.lastSellingPrice
        },
        description: `Price changed for item: ${updatedProduct.itemName} (${updatedProduct._id})`
      });
    }

    res.status(200).json(updatedProduct);
  } catch (error) {
    console.error('Error editing product:', error);
    res.status(500).json({ message: 'Error editing product', error });
  }
};

// Delete an existing product
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedProduct = await Item.findByIdAndDelete(id);
    if (!deletedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};


const StockLedger = require('../models/StockLedger');
const Purchase = require('../models/Purchase');

// Get item intelligence (Stock Ledger + Supplier History)
const getItemAnalytics = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Fetch Item details with aggregated stock
    const itemResults = await Item.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      {
        $lookup: {
          from: 'stocks',
          let: { itemId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$item_id', '$$itemId'] } } },
            { $group: { _id: null, total: { $sum: '$available_qty' } } }
          ],
          as: 'stockData'
        }
      },
      {
        $lookup: {
          from: 'nonserializedstocks',
          let: { itemId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$item_id', '$$itemId'] } } },
            { $group: { _id: null, total: { $sum: '$availableQty' } } }
          ],
          as: 'nonSerializedStockData'
        }
      },
      {
        $lookup: {
          from: 'serializedstocks',
          let: { itemId: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$item_id', '$$itemId'] }, { $eq: ['$status', 'Available'] }] } } },
            { $count: 'total' }
          ],
          as: 'serializedStockData'
        }
      },
      {
        $addFields: {
          totalStock: {
            $add: [
              { $ifNull: [{ $arrayElemAt: ['$stockData.total', 0] }, 0] },
              { $ifNull: [{ $arrayElemAt: ['$nonSerializedStockData.total', 0] }, 0] },
              { $ifNull: [{ $arrayElemAt: ['$serializedStockData.total', 0] }, 0] }
            ]
          }
        }
      }
    ]);

    if (!itemResults || itemResults.length === 0) return res.status(404).json({ message: 'Item not found' });
    const item = itemResults[0];

    // 2. Fetch Stock Ledger History (Most recent first)
    const ledger = await StockLedger.find({ item_id: id })
      .sort({ createdAt: -1 })
      .limit(50); // Limit to last 50 movements for performance

    // 3. Fetch Purchase History with Supplier Details
    const purchases = await Purchase.find({ "purchasedItems.item_id": id })
      .populate('supplier', 'business_name contact_info supplier_id')
      .sort({ purchaseDate: -1 });

    // Extract specific supplier metrics from purchases
    const supplierHistory = purchases.map(p => {
      const itemEntry = p.purchasedItems.find(pi => pi.item_id.toString() === id);
      return {
        purchaseId: p._id,
        supplier: p.supplier,
        purchaseDate: p.purchaseDate,
        reference: p.referenceNumber,
        unitCost: itemEntry?.unitCost,
        qty: itemEntry?.purchaseQty,
        status: p.purchase_status
      };
    });

    res.status(200).json({
      success: true,
      data: {
        item,
        ledger,
        supplierHistory
      }
    });
  } catch (err) {
    console.error('Error fetching item analytics:', err);
    res.status(500).json({ message: err.message });
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
  getItemAnalytics,
};
