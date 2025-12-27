const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customerController");

// Create a new customer
router.post("/", customerController.createCustomer);

// Get all customers
router.get("/", customerController.getCustomersAndAccounts);

// Get customers with accounts (specific route for clarity)
router.get("/with-accounts", customerController.getCustomersAndAccounts);


// Get a customer by ID
router.get("/:id", customerController.getCustomerById);

// Update a customer
router.put("/:id", customerController.updateCustomer);

// Delete a customer
router.delete("/:id", customerController.deleteCustomer);

module.exports = router;
