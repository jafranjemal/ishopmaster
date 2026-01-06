const NonSerializedStock = require("../models/NonSerializedStock");

// Get all non-serialized stock
exports.getNonSerializedStock = async (req, res) => {
  try {
    const stock = await NonSerializedStock.find().populate("item_id").populate("purchase_id");
    res.status(200).json(stock);
  } catch (err) {
    res.status(500).json({ message: "Error fetching non-serialized stock", error: err });
  }
};

// Add non-serialized stock
exports.addNonSerializedStock = async (req, res) => {
  const { item_id, variant_id, purchase_id, batch_number, purchaseQty, unitCost, sellingPrice, purchaseDate } = req.body;

  try {
    const newStock = new NonSerializedStock({
      item_id,
      variant_id,
      purchase_id,
      batch_number,
      purchaseQty,
      availableQty: purchaseQty,
      unitCost,
      sellingPrice,
      purchaseDate,
    });

    const savedStock = await newStock.save();
    res.status(201).json(savedStock);
  } catch (err) {
    res.status(500).json({ message: "Error adding non-serialized stock", error: err });
  }
};
