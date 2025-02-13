const express = require("express");
const router = express.Router();
const brandController = require("../controllers/brandController");

// Brand Routes
router.post("/", brandController.createBrand);
router.get("/", brandController.getBrands);
router.get("/:id", brandController.getBrandById);
router.put("/:id", brandController.updateBrand);
router.delete("/:id", brandController.deleteBrand);

module.exports = router;
