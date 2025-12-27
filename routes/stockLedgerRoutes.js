const express = require("express");
const router = express.Router();
const { getItemHistory, getAllAdjustments } = require("../controllers/stockLedgerController");

router.get("/history/:itemId", getItemHistory);
router.get("/adjustments", getAllAdjustments);

module.exports = router;
