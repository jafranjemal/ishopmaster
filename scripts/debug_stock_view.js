const mongoose = require('mongoose');
require('dotenv').config();

// Models
const Item = require('../models/Items');
const ItemVariant = require('../models/ItemVariantSchema');
const SerializedStock = require('../models/SerializedStock');
const NonSerializedStock = require('../models/NonSerializedStock');
const Purchase = require('../models/Purchase');
const Supplier = require('../models/Supplier');
require('../models/User'); // Register User model if needed

// DB Connection
const localUri = 'mongodb://localhost:27017/ishopmaster';
const mongoUri = 'mongodb+srv://jafranjemal:jafran123@cluster0.yai9p.mongodb.net/ishopmaster?retryWrites=true&w=majority';
const MONGODB_URI = process.env.NODE_ENV === 'production' ? mongoUri : localUri;

mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error(err));

async function runDebug() {
    try {
        console.log('--- STARTING AGGREGATION DEBUG ---');

        // 1. Find a Serialized Item to Query
        const targetItem = await SerializedStock.findOne({ status: "Available", batteryHealth: { $exists: true } }).populate('item_id');

        if (!targetItem) {
            console.log("No available serialized stock with batteryHealth found.");
            return;
        }

        const itemId = targetItem.item_id._id;
        console.log(`Target Item: ${targetItem.item_id.itemName} (${itemId})`);

        // 2. Run the Aggregation Pipeline from stockController.js
        const itemIds = [itemId];

        const serializedAgg = await SerializedStock.aggregate([
            { $match: { status: "Available", item_id: { $in: itemIds } } },
            { $sort: { purchaseDate: 1, createdAt: 1 } },

            {
                $lookup: {
                    from: "itemvariants",
                    localField: "variant_id",
                    foreignField: "_id",
                    as: "variantInfo",
                },
            },
            { $unwind: { path: "$variantInfo", preserveNullAndEmptyArrays: true } },

            {
                $group: {
                    _id: { item_id: "$item_id", variant_id: "$variantInfo._id" },
                    item_id: { $first: "$item_id" },
                    variant_id: { $first: "$variantInfo._id" },
                    totalAvailable: { $sum: 1 },
                    lastSellingPrice: { $last: "$sellingPrice" },
                    batteryHealth: { $last: "$batteryHealth" },
                    condition: { $last: "$condition" },

                    lastUnitCost: { $last: "$unitCost" },
                    stockUnits: {
                        $push: {
                            _id: "$_id",
                            serialNumber: "$serialNumber",
                            unitCost: "$unitCost",
                            sellingPrice: "$sellingPrice",
                            batteryHealth: "$batteryHealth",
                            condition: "$condition",
                            batch_number: "$batch_number",
                            purchaseDate: "$purchaseDate",
                            purchase_id: "$purchase_id",
                        },
                    },
                    batches: {
                        $push: {
                            batch_number: "$batch_number",
                            serialNumber: "$serialNumber",
                            batteryHealth: "$batteryHealth",
                            condition: "$condition",
                            status: "$status",
                            purchaseDate: "$purchaseDate",
                            unitCost: "$unitCost",
                            sellingPrice: "$sellingPrice",
                            purchase_id: "$purchase_id",
                        },
                    },
                },
            },

            { $unwind: "$batches" },
            {
                $lookup: {
                    from: "purchases",
                    localField: "batches.purchase_id",
                    foreignField: "_id",
                    as: "purchase_info",
                },
            },
            { $unwind: { path: "$purchase_info", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "suppliers",
                    localField: "purchase_info.supplier",
                    foreignField: "_id",
                    as: "supplier_info",
                },
            },
            { $unwind: { path: "$supplier_info", preserveNullAndEmptyArrays: true } },

            {
                $group: {
                    _id: { item_id: "$item_id", variant_id: "$variant_id" },
                    item_id: { $first: "$item_id" },
                    variant_id: { $first: "$variant_id" },
                    totalAvailable: { $first: "$totalAvailable" },
                    lastSellingPrice: { $first: "$lastSellingPrice" },
                    lastUnitCost: { $first: "$lastUnitCost" },
                    stockUnits: { $first: "$stockUnits" },
                    batteryHealth: { $first: "$batteryHealth" },
                    batches: {
                        $push: {
                            item_id: "$item_id",
                            batch_number: "$batches.batch_number",
                            serialNumber: "$batches.serialNumber",
                            batteryHealth: "$batches.batteryHealth", // <--- CRITICAL CHECK
                            condition: "$batches.condition",
                            status: "$batches.status",
                            purchaseDate: "$batches.purchaseDate",
                            unitCost: "$batches.unitCost",
                            sellingPrice: "$batches.sellingPrice",
                            purchase_id: "$batches.purchase_id",
                            purchase: "$purchase_info",
                            supplier: "$supplier_info",
                            invoiceNumber: { $ifNull: ["$purchase_info.referenceNumber", ""] },
                        },
                    },
                },
            },
        ]);

        console.log('--- AGGREGATION RESULT (First Batch Item) ---');
        if (serializedAgg.length > 0 && serializedAgg[0].batches.length > 0) {
            console.log(JSON.stringify(serializedAgg[0].batches[0], null, 2));
        } else {
            console.log("Empty result or no batches.");
        }

    } catch (error) {
        console.error("Debug Error:", error);
    } finally {
        mongoose.connection.close();
    }
}

runDebug();
