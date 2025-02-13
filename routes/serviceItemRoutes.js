const express = require("express");
const router = express.Router();
const serviceItemController = require("../controllers/serviceItemController");

// 📌 Routes for Service Items
router.post("/", serviceItemController.createServiceItem); // Create a new service item
router.get("/", serviceItemController.getAllServiceItems); // Get all service items
router.get("/:id", serviceItemController.getServiceItemById); // Get single service item by ID
router.put("/:id", serviceItemController.updateServiceItem); // Update service item
router.delete("/:id", serviceItemController.deleteServiceItem); // Delete service item
router.post('/check-exist', serviceItemController.checkExistServiceItems);

module.exports = router;
module.exports = router;
