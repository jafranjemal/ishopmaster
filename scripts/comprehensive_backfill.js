const mongoose = require('mongoose');
require('dotenv').config();

// Models
const Item = require('../models/Items');
const Purchase = require('../models/Purchase');
const SerializedStock = require('../models/SerializedStock');
const NonSerializedStock = require('../models/NonSerializedStock'); // In case needed

//const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ishop_master_db';
const localUri = 'mongodb://localhost:27017/ishopmaster';
const mongoUri = 'mongodb+srv://jafranjemal:jafran123@cluster0.yai9p.mongodb.net/ishopmaster?retryWrites=true&w=majority';
const MONGO_URI = process.env.NODE_ENV !== 'production' ? mongoUri : localUri;

const comprehensiveBackfill = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        // 1. Fetch all Purchases
        // We use cursor to avoid memory issues with large datasets, though standard find is likely fine for thousands
        const purchases = await Purchase.find({}).populate('purchasedItems.item_id');
        console.log(`Found ${purchases.length} purchases to scan.`);

        let updatedPurchases = 0;
        let updatedStock = 0;
        let errors = 0;

        for (const purchase of purchases) {
            let purchaseModified = false;

            for (const pItem of purchase.purchasedItems) {
                // Check if item exists (populated)
                if (!pItem.item_id) continue;

                const isDevice = pItem.item_id.category === 'Device';

                // --- Serialized Items Handling ---
                if (pItem.isSerialized && pItem.serializedItems && pItem.serializedItems.length > 0) {

                    for (const sItem of pItem.serializedItems) {
                        let itemModified = false;

                        // Default missing Condition
                        if (!sItem.condition) {
                            sItem.condition = 'Used';
                            itemModified = true;
                            purchaseModified = true;
                            // console.log(`[Purchase ${purchase.referenceNumber}] Set Condition=Used for Serial ${sItem.serialNumber}`);
                        }

                        // Default missing Battery Health (Only for Devices)
                        if (isDevice) {
                            if (sItem.batteryHealth === undefined || sItem.batteryHealth === null) {
                                sItem.batteryHealth = 100;
                                itemModified = true;
                                purchaseModified = true;
                                // console.log(`[Purchase ${purchase.referenceNumber}] Set BH=100 for Serial ${sItem.serialNumber}`);
                            }
                        }

                        // --- Sync to SerializedStock ---
                        // Only if we modified the Purchase, or just to be safe, check Stock too?
                        // User said "find purchased... update fields... old devices also needed"
                        // Safer to check Stock regardless of Purchase modification to ensure 100% sync.

                        const stock = await SerializedStock.findOne({ serialNumber: sItem.serialNumber });
                        if (stock) {
                            let stockModified = false;

                            // Condition check
                            if (!stock.condition) {
                                stock.condition = sItem.condition || 'Used';
                                stockModified = true;
                            }

                            // BH check
                            if (isDevice && (stock.batteryHealth === undefined || stock.batteryHealth === null)) {
                                stock.batteryHealth = sItem.batteryHealth !== undefined ? sItem.batteryHealth : 100;
                                stockModified = true;
                            }

                            if (stockModified) {
                                try {
                                    await stock.save();
                                    updatedStock++;
                                    console.log(`[Stock Sync] Updated Stock ${stock.serialNumber}`);
                                } catch (stockErr) {
                                    console.warn(`[Stock Sync Warning] Could not save ${stock.serialNumber}: ${stockErr.message}`);
                                    // Continue processing other items
                                }
                            }
                        }
                    }
                }
            }

            if (purchaseModified) {
                try {
                    // Mark the array as modified because we edited objects inside the array
                    purchase.markModified('purchasedItems');
                    await purchase.save();
                    updatedPurchases++;
                    console.log(`[Purchase] Updated Purchase ${purchase.referenceNumber}`);
                } catch (err) {
                    console.error(`[Error] Failed to save Purchase ${purchase.referenceNumber}:`, err.message);
                    errors++;
                }
            }
        }

        console.log(`-----------------------------------`);
        console.log(`Comprehensive Backfill Complete.`);
        console.log(`Purchases Updated: ${updatedPurchases}`);
        console.log(`Stock Items Synced: ${updatedStock}`);
        console.log(`Errors: ${errors}`);

        process.exit(0);

    } catch (error) {
        console.error('Script Error:', error);
        process.exit(1);
    }
};

comprehensiveBackfill();
