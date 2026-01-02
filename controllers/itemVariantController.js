const { default: mongoose } = require('mongoose');
const ItemVariant = require('../models/ItemVariantSchema'); // Using the schema file which exports the model
const Item = require('../models/Items');

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

        const newVariant = new ItemVariant({
            item_id,
            variantName: variantName.toUpperCase(), // Normalize to uppercase
            variantAttributes,
            sku,
            barcode,
            defaultSellingPrice,
            lastUnitCost
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
            return res.status(409).json({ message: "Duplicate Variant Name, SKU, or Barcode" });
        }
        res.status(400).json({ message: error.message });
    } finally {
        session.endSession();
    }
};

// Update a variant
const updateVariant = async (req, res) => {
    try {
        const { id } = req.params;

        // Normalize variantName if provided
        if (req.body.variantName) {
            req.body.variantName = req.body.variantName.toUpperCase();
        }

        const updatedVariant = await ItemVariant.findByIdAndUpdate(id, req.body, { new: true });

        if (!updatedVariant) return res.status(404).json({ message: "Variant not found" });

        res.status(200).json(updatedVariant);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Delete a variant
const deleteVariant = async (req, res) => {
    try {
        const { id } = req.params;
        // logic to check stock before delete should be here (e.g. check Stock collection)

        const deletedVariant = await ItemVariant.findByIdAndDelete(id);
        if (!deletedVariant) return res.status(404).json({ message: "Variant not found" });

        res.status(200).json({ message: "Variant deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getVariantsByItem,
    createVariant,
    updateVariant,
    deleteVariant
};
