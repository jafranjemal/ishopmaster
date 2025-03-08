const express = require("express");
const router = express.Router();
const { deleteSerializedStock, updateSerializedStock,
    getSerializedStockExist, 
    getSerializedStock, 
    addSerializedStock } = require("../controllers/serializedStockController");

router.get("/", getSerializedStock);
router.get("/exist/:serialNumber", getSerializedStockExist);
router.post("/", addSerializedStock);
router.patch('/:id',updateSerializedStock);
router.delete('/:id', deleteSerializedStock);

module.exports = router;
