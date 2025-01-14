const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");

// Get all notifications
router.get("/", notificationController.getNotifications);

// Mark a notification as read
router.post("/:id/mark-read", notificationController.markAsRead);

// Delete a notification
router.delete("/:id", notificationController.deleteNotification);

module.exports = router;
