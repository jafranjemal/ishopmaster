const SerializedStock = require("../models/SerializedStock");

// Get all serialized stock
exports.getSerializedStock = async (req, res) => {
  try {
    const stock = await SerializedStock.find().populate("item_id").populate("purchase_id");
    res.status(200).json(stock);
  } catch (err) {
    res.status(500).json({ message: "Error fetching serialized stock", error: err });
  }
};

exports.getSerializedStockExist = async (req, res) => {
  try {
    const { serialNumber } = req.params;

  if (!serialNumber) {
    return res.status(400).json({ error: "Serial number is required" });
  }
  console.log("serialNumber ", serialNumber)
  const serializedStock = await SerializedStock.findOne({ serialNumber: serialNumber });

  if (!serializedStock) {
    return res.status(404).json({ error: "Serialized stock not found" });
  }

  const isSold = serializedStock.status !== "Available";

  res.json( {isSold, status: serializedStock.status});
 
  } catch (err) {
    res.status(500).json({ message: "Error fetching serialized stock", error: err });
  }
};

// Add serialized stock
exports.addSerializedStock = async (req, res) => {
  const { item_id, purchase_id, serial_numbers, batch_number, unit_cost, selling_price, purchase_date } = req.body;

  try {
    const serializedItems = serial_numbers.map((serial) => ({
      item_id,
      purchase_id,
      serial_number: serial,
      batch_number,
      unit_cost,
      selling_price,
      purchase_date,
    }));

    const savedStock = await SerializedStock.insertMany(serializedItems);
    res.status(201).json(savedStock);
  } catch (err) {
    res.status(500).json({ message: "Error adding serialized stock", error: err });
  }
};

exports.updateSerializedStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { serialNumber, status, item_id, purchase_id } = req.body;

    if (!id) {
      return res.status(400).json({ error: "ID is required" });
    }

    const stock = await SerializedStock.findByIdAndUpdate(id, {
      serialNumber,
      status,
      item_id,
      purchase_id,
    }, { new: true });

    if (!stock) {
      return res.status(404).json({ error: "Serialized stock not found" });
    }

    res.status(200).json(stock);
  } catch (err) {
    res.status(500).json({ message: "Error updating serialized stock", error: err });
  }
};

exports.deleteSerializedStock = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "ID is required" });
    }

    const stock = await SerializedStock.findByIdAndDelete(id);

    if (!stock) {
      return res.status(404).json({ error: "Serialized stock not found" });
    }

    res.status(200).json({ message: "Serialized stock deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting serialized stock", error: err });
  }
};