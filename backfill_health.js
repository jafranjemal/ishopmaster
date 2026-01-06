const mongoose = require('mongoose');
require('dotenv').config();

const localUri = 'mongodb://localhost:27017/ishopmaster';

async function backfill() {
    try {
        await mongoose.connect(localUri);
        const SerializedStock = mongoose.connection.collection('serializedstocks');
        const Purchase = mongoose.connection.collection('purchases');

        // Find all serialized stocks where batteryHealth is missing
        const stocks = await SerializedStock.find({
            $or: [
                { batteryHealth: { $exists: false } },
                { batteryHealth: null }
            ]
        }).toArray();

        console.log(`Found ${stocks.length} records to inspect.`);

        for (const stock of stocks) {
            if (!stock.purchase_id) continue;

            const purchase = await Purchase.findOne({ _id: stock.purchase_id });
            if (!purchase) continue;

            // Look for the specific serial in the purchase items
            let foundHealth = null;
            for (const item of purchase.purchasedItems || []) {
                if (item.serializedItems) {
                    const unit = item.serializedItems.find(u => u.serialNumber === stock.serialNumber);
                    if (unit) {
                        foundHealth = unit.batteryHealth ?? unit.bateryhealth ?? unit.battery_health;
                        break;
                    }
                }
            }

            if (foundHealth !== null && foundHealth !== undefined) {
                console.log(`Updating Serial ${stock.serialNumber} with health ${foundHealth}`);
                await SerializedStock.updateOne(
                    { _id: stock._id },
                    { $set: { batteryHealth: Number(foundHealth) } }
                );
            }
        }

        console.log('Backfill complete.');
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.connection.close();
    }
}

backfill();
