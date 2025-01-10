const express = require("express");
const router = express.Router();
const purchaseController = require("../controllers/purchaseController");

router.post("/", purchaseController.createPurchase);
router.get("/", purchaseController.getAllPurchases);
router.get("/:id", purchaseController.getPurchaseById);
router.put("/:id", purchaseController.updatePurchase);
router.delete("/:id", purchaseController.deletePurchase);
router.get('/due-purchases/supplier/:id', purchaseController.getDuePurchaseBySupplierId);

module.exports = router;
