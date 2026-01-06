const mongoose = require('mongoose');
const mongoUri = 'mongodb://localhost:27017/ishopmaster'; // Adjust if needed

async function checkStock() {
    try {
        await mongoose.connect(mongoUri);
        const SerializedStock = mongoose.connection.collection('serializedstocks');

        const itemId = "68ac6107d5836fcb1f513112";
        const stocks = await SerializedStock.find({ item_id: new mongoose.Types.ObjectId(itemId) }).toArray();

        console.log(`Found ${stocks.length} serials for item ${itemId}`);
        stocks.forEach(s => {
            console.log(`Serial: ${s.serialNumber}`);
            console.log(`Fields: ${Object.keys(s).join(', ')}`);
            console.log(`batteryHealth: ${s.batteryHealth}`);
            console.log(`bateryhealth: ${s.bateryhealth}`);
            console.log(`battery_health: ${s.battery_health}`);
            console.log('---');
        });

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.connection.close();
    }
}

checkStock();
