const express = require("express");
const router = express.Router();
const purchaseController = require("../controllers/purchaseController");

router.post("/", purchaseController.createPurchase);
router.get("/", purchaseController.getAllPurchases);
router.get("/:id", purchaseController.getPurchaseById);
router.put("/:purchaseId", purchaseController.updatePurchase);
router.delete("/:purchaseId", purchaseController.deletePurchase);
router.get('/due-purchases/supplier/:id', purchaseController.getDuePurchaseBySupplierId);

module.exports = router;
