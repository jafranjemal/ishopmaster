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
