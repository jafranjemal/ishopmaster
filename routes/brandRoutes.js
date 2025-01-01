const express = require("express");
const router = express.Router();
const brandController = require("../controllers/brandController");

// Brand Routes
router.post("/", brandController.createBrand);
router.get("/", brandController.getBrands);
router.get("/brands/:id", brandController.getBrandById);
router.put("/brands/:id", brandController.updateBrand);
router.delete("/brands/:id", brandController.deleteBrand);

module.exports = router;
