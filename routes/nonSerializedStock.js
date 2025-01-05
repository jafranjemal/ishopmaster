const express = require("express");
const router = express.Router();
const { getNonSerializedStock, addNonSerializedStock } = require("../controllers/nonSerializedStockController");

router.get("/non-serialized", getNonSerializedStock);
router.post("/non-serialized", addNonSerializedStock);

module.exports = router;
