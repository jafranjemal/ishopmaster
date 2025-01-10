// routes/supplierRoutes.js
const express = require("express");
const router = express.Router();
const supplierController = require("../controllers/supplierController");

// Routes for Supplier CRUD operations
router.get("/", supplierController.getSuppliers); // Get all suppliers
router.get("/:id", supplierController.getSupplierById); // Get supplier by ID
router.post("/", supplierController.addSupplier); // Add a new supplier
router.put("/:id", supplierController.updateSupplier); // Update an existing supplier
router.delete("/:id", supplierController.deleteSupplier); // Delete a supplier
module.exports = router;
 