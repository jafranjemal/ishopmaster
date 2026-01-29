const Item = require('../models/Items');
const SerializedStock = require('../models/SerializedStock');
const NonSerializedStock = require('../models/NonSerializedStock');
const ItemVariant = require('../models/ItemVariantSchema');
const InventoryValidationService = require('../services/InventoryValidationService');
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
        { barcode: { $regex: search, $options: 'i' } }
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
      },
      // Lookup 4: Variant Count
      {
        $lookup: {
          from: 'itemvariants',
          localField: '_id',
          foreignField: 'item_id',
          as: 'variants'
        }
      },
      {
        $addFields: {
          variantCount: { $size: '$variants' }
        }
      },
      {
        $project: {
          variants: 0 // Remove the variants array to keep response small
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

const checkBarcodeAndVariantRules = async (productData, productId = null) => {
  // Rule: If an item has variants, its `barcode` field must be null/empty.
  // This is enforced by checking if variants exist for this item (or if it's a new item that might get variants).
  // For an existing item, if a `barcode` is provided, we must ensure no variants exist for it.
  // For a new item, we generally expect `barcode` to be null if it's intended for variants.

  if (productData.barcode) {
    let itemToCheck;
    if (productId) {
      // Existing item
      itemToCheck = await Item.findById(productId);
      if (!itemToCheck) {
        throw new Error('Product not found for update.');
      }
    } else {
      // New item - use the provided data for initial check
      // The actual document will be created after this check
      itemToCheck = { _id: null, ...productData }; // Simulate an item for variant check
    }

    // Check if variants exist for this item
    const variantCount = await ItemVariant.countDocuments({ item_id: itemToCheck._id });
    if (variantCount > 0) {
      throw new Error('Barcode cannot be set on a product that has variants. Please clear the barcode or remove existing variants first.');
    }
  }
};

// Add a new product
const addProduct = async (req, res) => {
  try {
    const productData = req.body;

    // 🔥 FIX: Remove _id if it's null so Mongoose can generate a real one
    if (productData._id === null || productData._id === "") {
      delete productData._id;
    }
    if (productData.phoneModelId === null || productData.phoneModelId === "") {
      delete productData.phoneModelId;
    }

    // Validate input data
    validateProductData(productData);

    // Check barcode rules for new product
    try {
      await InventoryValidationService.validateItemBarcodeAndVariantCompliance(productData);
    } catch (err) {
      console.error('Barcode validation error for new product:', err);
      return res.status(400).json({ success: false, message: err.message });
    }

    // Check for duplicate product (case-insensitive)
    const existingProduct = await Item.findOne({
      itemName: {
        $regex: new RegExp(`^${productData.itemName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
      }
    });
    if (existingProduct) {
      console.log('Product with this name already exists:', existingProduct.itemName);
      return res.status(409).json({ message: 'Product with this name already exists' });
    }

    // Create new product
    const product = new Item(productData);
    const savedProduct = await product.save();

    // --- Automatically create a DEFAULT variant (only if no variants will be created immediately) ---
    // Note: This creates a default variant for items that don't have variants yet
    // If the UI will immediately show a variant creation modal, this default variant might not be needed
    try {
      // Get the selling price from either pricing.sellingPrice or the root sellingPrice field
      // Also check for direct sellingPrice in the original request data
      const itemSellingPrice = savedProduct.pricing?.sellingPrice || savedProduct.sellingPrice || productData.sellingPrice || 0;
      const itemLastUnitCost = savedProduct.lastUnitCost || savedProduct.costPrice || productData.costPrice || 0;

      // Create default variant name as "BASE_ITEM_NAME DEFAULT"
      const defaultVariantName = `${savedProduct.itemName} DEFAULT`;

      // await ItemVariant.create({
      //   item_id: savedProduct._id,
      //   variantName: defaultVariantName,
      //   variantAttributes: [],
      //   sku: savedProduct.sku || null,
      //   barcode: savedProduct.barcode || null,
      //   defaultSellingPrice: itemSellingPrice,
      //   lastUnitCost: itemLastUnitCost
      // });
      console.log(`Default variant created for item: ${savedProduct.itemName} with price: ${itemSellingPrice}`);
    } catch (variantErr) {
      console.error('Error creating default variant:', variantErr);
      // We don't fail the whole request if the variant fails, but it should ideally work.
    }
    // ----------------------------------------------

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: savedProduct.toObject()
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

    // Check barcode rules for existing product update
    try {
      await InventoryValidationService.validateItemBarcodeAndVariantCompliance(req.body, productId);
    } catch (err) {
      console.error('Barcode validation error for product update:', err);
      return res.status(400).json({ success: false, message: err.message });
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
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    // 1. Fetch all variant IDs to check their stock specifically
    const variants = await ItemVariant.find({ item_id: id }).session(session);
    const variantIds = variants.map(v => v._id);

    // 2. Check for available stock across all sources for this item and its variants
    const stockChecks = await Promise.all([
      SerializedStock.countDocuments({
        $or: [
          { item_id: id },
          { variant_id: { $in: variantIds } }
        ]
      }).session(session),
      NonSerializedStock.countDocuments({
        $or: [
          { item_id: id },
          { variant_id: { $in: variantIds } }
        ]
      }).session(session)
    ]);

    const totalAvailableStock = stockChecks.reduce((a, b) => a + b, 0);

    if (totalAvailableStock > 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Cannot delete item. It has ${totalAvailableStock} stock records (including variants). Please clear stock first.`
      });
    }

    // 2. Cascading Delete: Delete all variants associated with this item
    await ItemVariant.deleteMany({ item_id: id }).session(session);

    // 3. Delete the item itself
    const deletedProduct = await Item.findByIdAndDelete(id).session(session);

    if (!deletedProduct) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Product not found' });
    }

    await session.commitTransaction();
    res.status(200).json({ message: 'Product and associated variants deleted successfully' });
  } catch (err) {
    await session.abortTransaction();
    console.error('deleteProduct error:', err);
    res.status(500).json({ message: err.message });
  } finally {
    session.endSession();
  }
};


const StockLedger = require('../models/StockLedger');
const Purchase = require('../models/Purchase');

// Get item intelligence (Stock Ledger + Supplier History + Granular Stock)
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
      .limit(50);

    // 3. Fetch Purchase History with Supplier Details
    const purchases = await Purchase.find({ "purchasedItems.item_id": id })
      .populate('supplier', 'business_name contact_info supplier_id')
      .sort({ purchaseDate: -1 });

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

    // 4. NEW: Fetch Granular Stock Details (Serials and Batches)
    // Fetch all "Available" serials for this item
    const availableSerialsRaw = await SerializedStock.find({
      item_id: id,
      status: 'Available'
    }).populate({ path: 'variant_id', select: 'variantName', strictPopulate: false }).lean();

    // Map to ensure batteryHealth is correctly picked up
    const availableSerials = availableSerialsRaw.map(s => ({
      ...s,
      batteryHealth: s.batteryHealth // Keep battery_health just in case of snake_case DB fields
    }));

    // Fetch all active batches for non-serialized stock
    const activeBatches = await NonSerializedStock.find({
      item_id: id,
      availableQty: { $gt: 0 }
    }).populate({ path: 'variant_id', select: 'variantName', strictPopulate: false });

    res.status(200).json({
      success: true,
      data: {
        item,
        ledger,
        supplierHistory,
        availableSerials,
        activeBatches
      }
    });
  } catch (err) {
    console.error('Error fetching item analytics:', err);
    res.status(500).json({ message: err.message });
  }
};

// Check if item name exists (for frontend validation)
const checkItemName = async (req, res) => {
  try {
    const { name, excludeId } = req.query;
    if (!name) return res.status(400).json({ message: 'Name query parameter is required' });

    const query = {
      itemName: {
        $regex: new RegExp(`^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
      }
    };

    if (excludeId && mongoose.Types.ObjectId.isValid(excludeId)) {
      query._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
    }

    const existing = await Item.findOne(query).select('itemName');
    res.status(200).json({ exists: !!existing });
  } catch (err) {
    console.error('checkItemName error:', err);
    res.status(500).json({ message: err.message });
  }
};

// Check if barcode or SKU exists across items and variants
const checkBarcode = async (req, res) => {
  try {
    const { value, excludeId } = req.query;
    if (!value) return res.status(400).json({ message: 'Value query parameter is required' });

    // 1. Check in Items (Barcode only)
    const itemQuery = { barcode: value };
    if (excludeId && mongoose.Types.ObjectId.isValid(excludeId)) {
      itemQuery._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
    }
    const existingItem = await Item.findOne(itemQuery).select('barcode itemName');
    if (existingItem) {
      return res.status(200).json({ exists: true, type: 'Item', name: existingItem.itemName, field: 'barcode' });
    }

    // 2. Check in ItemVariants (Barcode or SKU)
    const variantQuery = {
      $or: [
        { barcode: value },
        { sku: value }
      ]
    };
    if (excludeId && mongoose.Types.ObjectId.isValid(excludeId)) {
      variantQuery._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
    }
    const ItemVariant = require('../models/ItemVariantSchema');
    const existingVariant = await ItemVariant.findOne(variantQuery).select('barcode sku variantName');
    if (existingVariant) {
      const field = existingVariant.barcode === value ? 'barcode' : 'sku';
      return res.status(200).json({ exists: true, type: 'Variant', name: existingVariant.variantName, field });
    }

    res.status(200).json({ exists: false });
  } catch (err) {
    console.error('checkBarcode error:', err);
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
  checkItemName,
  checkBarcode
};
