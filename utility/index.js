const Item = require('../models/Items');
const SerializedStock = require('../models/SerializedStock');
const NonSerializedStock = require('../models/NonSerializedStock');
const Notification = require('../models/Notification');
const sendNotification = require('../server');
 
 const generateCustomId = (prefix) => {
  const timestamp = new Date().getTime();
  const randomNum = Math.floor(Math.random() * 100000);
  return `${prefix}-${timestamp}${randomNum}`;
};


 

async function checkStockLevels() {
  try {
    console.log('Running stock alert scheduler...');

    // Step 1: Fetch items with alertQty set
    const itemsWithAlert = await Item.find({ alertQuantity: { $exists: true, $gt: 0 } });

    console.log("itemsWithAlert ; ", itemsWithAlert)
    for (const item of itemsWithAlert) {
      let totalStock = 0;

      if (item.serialized) {
        // For serialized items: Count available stock
        const serializedCount = await SerializedStock.countDocuments({
          item_id: item._id,
          status: 'Available',
        });
        totalStock += serializedCount;
      } else {
        // For non-serialized items: Sum availableQty
        const nonSerializedStock = await NonSerializedStock.aggregate([
          { $match: { item_id: item._id } },
          { $group: { _id: null, totalQty: { $sum: '$availableQty' } } },
        ]);
        totalStock += nonSerializedStock[0]?.totalQty || 0;
      }

      // Step 2: Check if total stock is below the alertQty
      if (totalStock < item.alertQuantity) {
        // Step 3: Create a notification
       const notification =  await Notification.create({
          type: 'Stock Alert',
          message: `Low stock alert for ${item.itemName}. Remaining stock: ${totalStock}. Threshold: ${item.alertQuantity}.`,
          created_at: new Date(),
        });
        console.log(typeof notification); // Should log "function"

        sendNotification(notification)
        console.log(`Notification created for item: ${item.itemName}`);
      }
    }
  } catch (error) {
    console.error('Error running stock alert scheduler:', error);
  }
}
 

module.exports = {
    generateCustomId,
    checkStockLevels
}
