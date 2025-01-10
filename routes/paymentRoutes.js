
// Get a single payment by ID

const express = require("express");
const router = express.Router();
 
const paymentController = require("../controllers/paymentController");

router.get("/:paymentId", paymentController.getPaymentById);
// Update a payment
router.put("/:paymentId", paymentController.updatePayment);
// Delete a payment
router.delete("/:paymentId", paymentController.deletePayment);
// Get payments by account ID
router.get("/account/:accountId", paymentController.getPaymentsByAccount);
//Get all payment by purchased id
router.get("/purchased/:purchaseId", paymentController.getPaymentsByPurchaseId);

// Get payments by date range
router.get("/date-range", paymentController.getPaymentsByDateRange);

// Get total amount paid in a given period or account
router.get("/summary", paymentController.getPaymentSummary);
router.get("/", paymentController.getPayments);
router.post("/", paymentController.addPayment);

module.exports = router;
