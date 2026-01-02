const mongoose = require('mongoose');
require('dotenv').config();

// Models
const Item = require('../models/Items');
// const ItemVariant = require('../models/ItemVariantSchema'); // Not strictly needed for category check if in Item
const SerializedStock = require('../models/SerializedStock');

//const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ishop_master_db';
const localUri = 'mongodb://localhost:27017/ishopmaster';
const mongoUri = 'mongodb+srv://jafranjemal:jafran123@cluster0.yai9p.mongodb.net/ishopmaster?retryWrites=true&w=majority';
const MONGO_URI = process.env.NODE_ENV === 'production' ? mongoUri : localUri;

const backfillData = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        // 1. Find all SerializedStock items
        // We populate item_id to check category
        const stocks = await SerializedStock.find({ status: 'Available' }).populate('item_id');

        console.log(`Found ${stocks.length} available serialized items.`);

        let updatedCount = 0;
        let errors = 0;

        for (const stock of stocks) {
            if (!stock.item_id) {
                console.warn(`Stock ID ${stock._id} has no linked Item! Skipping.`);
                continue;
            }

            // Check if it is a Device
            if (stock.item_id.category === 'Device') {
                let modified = false;

                // Check Battery Health
                if (stock.batteryHealth === undefined || stock.batteryHealth === null) {
                    stock.batteryHealth = 100; // Defaulting to 100% for legacy data
                    modified = true;
                    console.log(`[Updating] Stock ${stock.serialNumber}: Setting default Battery Health to 100%`);
                }

                // Check Condition
                if (!stock.condition) {
                    stock.condition = 'Used'; // Defaulting to Used
                    modified = true;
                    console.log(`[Updating] Stock ${stock.serialNumber}: Setting default Condition to Used`);
                }

                if (modified) {
                    try {
                        await stock.save();
                        updatedCount++;
                    } catch (err) {
                        console.error(`Failed to save stock ${stock.serialNumber}:`, err.message);
                        errors++;
                    }
                }
            }
        }

        console.log(`-----------------------------------`);
        console.log(`Backfill Complete.`);
        console.log(`Updated: ${updatedCount}`);
        console.log(`Errors: ${errors}`);

        process.exit(0);

    } catch (error) {
        console.error('Script Error:', error);
        process.exit(1);
    }
};

backfillData();
