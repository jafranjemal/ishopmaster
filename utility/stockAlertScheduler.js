const nodeCron = require("node-cron");
const Stock = require("../models/Stock"); // Adjust to your stock model path
const { sendNotification } = require("../server"); // Ensure the correct path

const stockAlertScheduler = () => {
  nodeCron.schedule("0 * * * *", async () => {
    console.log("Running stock alert scheduler...");
    try {
      // Fetch items with low stock
      const lowStockItems = await Stock.find({ availableQty: { $lte: "alertQty" } });

      if (lowStockItems.length) {
        for (const item of lowStockItems) {
          const notification = {
            message: `Stock low for item: ${item.name}, available: ${item.availableQty}`,
            type: "Stock Alert",
          };

          // Save notification to DB
          // Assuming a Notification model exists
          await Notification.create(notification);

          // Send notification via WebSocket
          sendNotification(notification);
        }
      }
    } catch (error) {
      console.error("Error running stock alert scheduler:", error);
    }
  });
};

module.exports = stockAlertScheduler;
