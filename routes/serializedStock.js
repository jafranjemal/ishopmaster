const express = require("express");
const router = express.Router();
const { getSerializedStock, addSerializedStock } = require("../controllers/serializedStockController");

router.get("/serialized", getSerializedStock);
router.post("/serialized", addSerializedStock);

module.exports = router;
