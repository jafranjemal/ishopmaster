const express = require("express");
const router = express.Router();
const purchaseController = require("../controllers/purchaseController");
const stockController = require("../controllers/stockController");
const { authenticate } = require("../middleware/auth");

router.post("/", authenticate, purchaseController.createPurchase);
router.get("/", authenticate, purchaseController.getAllPurchases);
router.get("/search-purchases", authenticate, purchaseController.searchPurchases);
router.get("/barcode-data/:purchaseId", authenticate, stockController.getBarcodeDataByPurchase);
router.get("/:id", authenticate, purchaseController.getPurchaseById);
router.put("/:purchaseId", authenticate, purchaseController.updatePurchase);
router.put("/usp/:purchaseId", authenticate, purchaseController.updatePurchaseSellingPrice);
router.delete("/:purchaseId", authenticate, purchaseController.deletePurchase);
router.post("/verify/:id", authenticate, purchaseController.verifyPurchasePhysical);
router.get('/due-purchases/supplier/:id', authenticate, purchaseController.getDuePurchaseBySupplierId);
router.get('/due/supplier/:id', authenticate, purchaseController.getDuePurchaseBySupplierId);
router.get("/check-reference/:referenceNumber", authenticate, purchaseController.checkReferenceNumber);

module.exports = router;
