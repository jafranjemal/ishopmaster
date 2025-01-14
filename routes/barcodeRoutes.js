const express = require("express");
const router = express.Router();
const BarcodeTemplateController = require("../controllers/barcodeTemplateController");

// Route to create a new barcode template
router.post("/", BarcodeTemplateController.createTemplate);

// Route to get all barcode templates
router.get("/", BarcodeTemplateController.getTemplates);

// Route to get a specific barcode template by ID
router.get("/:id", BarcodeTemplateController.getTemplateById);

// Route to update a barcode template
router.put("/:id", BarcodeTemplateController.updateTemplate);

// Route to delete a barcode template
router.delete("/:id", BarcodeTemplateController.deleteTemplate);

module.exports = router;
