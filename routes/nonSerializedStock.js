const express = require("express");
const router = express.Router();
const { getNonSerializedStock, addNonSerializedStock } = require("../controllers/nonSerializedStockController");

router.get("/", getNonSerializedStock);
router.post("/", addNonSerializedStock);

module.exports = router;
