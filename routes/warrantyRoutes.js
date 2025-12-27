const express = require("express");
const router = express.Router();
const warrantyController = require("../controllers/warrantyController");

// Get all warranties with filters/pagination
router.get("/", warrantyController.getWarranties);

// Get warranty dashboard/stats
router.get("/stats", warrantyController.getWarrantyDashboard);

// Claim a warranty
router.post("/claim", warrantyController.claimWarranty);

// Update a warranty (status/notes)
router.put("/:id", warrantyController.updateWarranty);

module.exports = router;
