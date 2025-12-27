const express = require("express");
const router = express.Router();
const purchaseController = require("../controllers/purchaseController");

router.post("/", purchaseController.createPurchase);
router.get("/", purchaseController.getAllPurchases);
router.get("/search-purchases", purchaseController.searchPurchases);
router.get("/:id", purchaseController.getPurchaseById);
router.put("/:purchaseId", purchaseController.updatePurchase);
router.put("/usp/:purchaseId", purchaseController.updatePurchaseSellingPrice);
router.delete("/:purchaseId", purchaseController.deletePurchase);
router.post("/verify/:id", purchaseController.verifyPurchasePhysical);
router.get('/due-purchases/supplier/:id', purchaseController.getDuePurchaseBySupplierId);

module.exports = router;
