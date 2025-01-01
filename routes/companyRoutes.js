// routes/companyRoutes.js

const express = require("express");
const router = express.Router();
const companyController = require("../controllers/companyController");

// Route to create a new company
router.post("/", companyController.createCompany);

// Route to get all companies
router.get("/", companyController.getAllCompanies);

// Route to get a specific company by ID
router.get("/:id", companyController.getCompanyById);

// Route to update a company by ID
router.put("/:id", companyController.updateCompany);

// Route to delete a company by ID
router.delete("/:id", companyController.deleteCompany);

// Get company profile
router.get("/:companyId/profile", companyController.getCompanyProfile);
module.exports = router;
 