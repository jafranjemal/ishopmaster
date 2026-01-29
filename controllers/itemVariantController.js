const { default: mongoose } = require('mongoose');
const ItemVariant = require('../models/ItemVariantSchema'); // Using the schema file which exports the model
const Item = require('../models/Items');
const SerializedStock = require('../models/SerializedStock');
const NonSerializedStock = require('../models/NonSerializedStock');
const InventoryValidationService = require('../services/InventoryValidationService');
const { generateUniversalSku, processText } = require('../utility/skuHelper');

// Get all variants for a specific item
// Get all variants for a specific item with stock aggregation
const getVariantsByItem = async (req, res) => {
    try {
        const { itemId } = req.params;
        const variants = await ItemVariant.aggregate([
            { $match: { item_id: new mongoose.Types.ObjectId(itemId) } },
            // Lookup 1: Total from 'stocks' (Legacy/General) matching variant_id
            {
                $lookup: {
                    from: 'stocks',
                    let: { variantId: '$_id' },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$variant_id', '$$variantId'] } } },
                        { $group: { _id: null, total: { $sum: '$available_qty' } } }
                    ],
                    as: 'stockData'
                }
            },
            // Lookup 2: Total from 'nonserializedstocks' matching variant_id
            {
                $lookup: {
                    from: 'nonserializedstocks',
                    let: { variantId: '$_id' },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$variant_id', '$$variantId'] } } },
                        { $group: { _id: null, total: { $sum: '$availableQty' } } }
                    ],
                    as: 'nonSerializedStockData'
                }
            },
            // Lookup 3: Total from 'serializedstocks' matching variant_id and Status: Available
            {
                $lookup: {
                    from: 'serializedstocks',
                    let: { variantId: '$_id' },
                    pipeline: [
                        { $match: { $expr: { $and: [{ $eq: ['$variant_id', '$$variantId'] }, { $eq: ['$status', 'Available'] }] } } },
                        { $count: 'total' }
                    ],
                    as: 'serializedStockData'
                }
            },
            // Calculate final totalStock
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
        res.status(200).json(variants);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Create a new variant
const createVariant = async (req, res) => {
    const mongoose = require('mongoose');
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { item_id, variantName, variantAttributes, sku, barcode, defaultSellingPrice, lastUnitCost } = req.body;

        // Check if item exists
        const item = await Item.findById(item_id).session(session);
        if (!item) {
            await session.abortTransaction();
            return res.status(404).json({ message: "Base Item not found" });
        }

        // Use the InventoryValidationService for validation
        try {
            // For creation, variantIdToUpdate is null
            await InventoryValidationService.validateVariantData(item_id, { sku, barcode }, null);
        } catch (validationError) {
            await session.abortTransaction();
            return res.status(400).json({ message: validationError.message });
        }

        // The existing stock check from the original code remains a good business practice:
        const serializedStockCount = await SerializedStock.countDocuments({
            item_id: item_id,
            variant_id: null
        }).session(session);

        const nonSerializedStockCount = await NonSerializedStock.countDocuments({
            item_id: item_id,
            variant_id: null,
            availableQty: { $gt: 0 }
        }).session(session);

        // Optional: Decide if existing base stock should prevent variant creation
        // For now, we'll log a warning but allow it if other rules pass.
        if (serializedStockCount > 0 || nonSerializedStockCount > 0) {
            console.warn(`Warning: Creating variants for item ${item_id} which has existing base stock. Review business requirements.`);
        }

        const newVariant = new ItemVariant({
            ...req.body,
            item_id,
            variantName: variantName.toUpperCase(), // Normalize to uppercase
            variantAttributes,
            sku,
            barcode,
            defaultSellingPrice,
            lastUnitCost,
            stockTracking: {
                currentStock: 0,
                availableForSale: 0,
                reorderPoint: item.stockTracking?.reorderPoint || 0
            }
        });

        const savedVariant = await newVariant.save({ session });

        // Update Base Item to indicate it has variants
        if (!item.hasVariants) {
            item.hasVariants = true;
            await item.save({ session });
        }

        await session.commitTransaction();
        res.status(201).json(savedVariant);
    } catch (error) {
        await session.abortTransaction();

        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            const message = `Duplicate ${field === 'barcode' ? 'Barcode' : field === 'sku' ? 'SKU' : 'Variant Name'} detected`;
            return res.status(409).json({ message });
        }
        res.status(400).json({ message: error.message });
    } finally {
        session.endSession();
    }
};

// Update a variant
const updateVariant = async (req, res) => {
    const mongoose = require('mongoose');
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        const updateData = req.body;

        // Normalize variantName if provided
        if (updateData.variantName) {
            updateData.variantName = updateData.variantName.toUpperCase();
        }

        // Find the variant to be updated
        const variantToUpdate = await ItemVariant.findById(id).session(session);
        if (!variantToUpdate) {
            await session.abortTransaction();
            return res.status(404).json({ message: "Variant not found" });
        }

        // Find the parent item for validation checks
        const parentItem = await Item.findById(variantToUpdate.item_id).session(session);
        if (!parentItem) {
            await session.abortTransaction();
            return res.status(404).json({ message: "Parent item not found for this variant." });
        }

        // Use the InventoryValidationService for validation
        try {
            // For updates, pass the variant's ID as variantIdToUpdate
            await InventoryValidationService.validateVariantData(variantToUpdate.item_id, { sku: updateData.sku, barcode: updateData.barcode }, id);
        } catch (validationError) {
            await session.abortTransaction();
            return res.status(400).json({ message: validationError.message });
        }

        const updatedVariant = await ItemVariant.findByIdAndUpdate(
            id,
            updateData,
            { new: true, session }
        );

        await session.commitTransaction();
        res.status(200).json(updatedVariant);
    } catch (error) {
        await session.abortTransaction();
        res.status(500).json({ message: error.message });
    } finally {
        session.endSession();
    }
};

// Delete a variant
const deleteVariant = async (req, res) => {
    try {
        const { id } = req.params;

        // Check for available stock specifically for this variant
        const stockChecks = await Promise.all([
            SerializedStock.countDocuments({ variant_id: id, status: 'Available' }),
            NonSerializedStock.countDocuments({ variant_id: id, availableQty: { $gt: 0 } })
        ]);

        const totalAvailableStock = stockChecks.reduce((a, b) => a + b, 0);

        if (totalAvailableStock > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete variant with active stock. Please sell or adjust stock to 0 first.'
            });
        }

        const deletedVariant = await ItemVariant.findByIdAndDelete(id);
        if (!deletedVariant) return res.status(404).json({ message: "Variant not found" });

        res.status(200).json({ message: "Variant deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Check if variant name/attributes already exist for an item
const checkDuplicateVariant = async (req, res) => {
    try {
        const { itemId, name, excludeId } = req.query;
        if (!itemId || !name) {
            return res.status(400).json({ message: "itemId and name are required" });
        }

        const query = {
            item_id: new mongoose.Types.ObjectId(itemId),
            variantName: {
                $regex: new RegExp(`^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
            }
        };

        if (excludeId && mongoose.Types.ObjectId.isValid(excludeId)) {
            query._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
        }

        const existing = await ItemVariant.findOne(query).select('variantName');
        res.status(200).json({ exists: !!existing });
    } catch (error) {
        console.error('checkDuplicateVariant error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Create a default variant (triggered by "No" on frontend modal)
// Create Default Variant (Auto-generated)
const createDefaultVariant = async (req, res) => {
    const mongoose = require('mongoose');
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        console.log("createDefaultVariant Payload:", req.body);
        const { itemId } = req.body;

        if (!itemId) {
            await session.abortTransaction();
            return res.status(400).json({ message: "Item ID is required" });
        }

        const item = await Item.findById(itemId).session(session);
        if (!item) {
            await session.abortTransaction();
            return res.status(404).json({ message: "Base Item not found" });
        }

        // Check if Default Variant already exists
        const existingVariants = await ItemVariant.find({ item_id: itemId }).session(session);
        const isDuplicate = existingVariants.some(v =>
            v.variantName.toUpperCase().includes("DEFAULT") ||
            (v.variantAttributes.length === 0)
        );

        if (isDuplicate) {
            await session.abortTransaction();
            return res.status(409).json({ message: "A default or base variant already exists." });
        }

        // Generate Data
        const randomStr = Math.floor(10000000 + Math.random() * 90000000).toString();
        const sku = req.body.sku || generateUniversalSku(item);
        const newSku = sku.endsWith('-STD') || sku.endsWith('-DFT') ? sku : `${sku}-STD`;
        const newBarcode = `VAR-${randomStr}`;

        const newVariant = new ItemVariant({
            item_id: itemId,
            variantName: `${item.itemName} - Standard`,
            sku: newSku,
            barcode: newBarcode,
            variantAttributes: [],
            defaultSellingPrice: item.pricing?.sellingPrice || item.sellingPrice || 0,
            lastUnitCost: item.lastUnitCost || item.costPrice || 0,
            variantImage: item.itemImage || '',
            stockTracking: {
                currentStock: 0,
                availableForSale: 0,
                reorderPoint: item.stockTracking?.reorderPoint || 0
            }
        });

        await newVariant.save({ session });

        // Update Base Item:
        // WORKAROUND: The 'barcode' index is Unique but likely NOT Sparse. 
        // This means we cannot set multiple items to 'null' or missing.
        // We set a unique placeholder instead of unsetting it.
        await Item.findByIdAndUpdate(itemId, {
            $set: {
                hasVariants: true,
                barcode: `BASE-${item.barcode}`
            }
        }, { session });

        await session.commitTransaction();
        res.status(201).json({ message: "Default variant created", variant: newVariant });

    } catch (error) {
        await session.abortTransaction();
        console.error("createDefaultVariant Failed:", error);
        res.status(500).json({ message: error.message || "Internal Server Error" });
    } finally {
        session.endSession();
    }
};


module.exports = {
    getVariantsByItem,
    createVariant,
    updateVariant,
    deleteVariant,
    checkDuplicateVariant,
    createDefaultVariant
};
