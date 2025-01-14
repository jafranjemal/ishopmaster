const { default: mongoose } = require("mongoose");

const stockMovementSchema = new mongoose.Schema({
    item_id: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    movement_type: { type: String, enum: ["Addition", "Deduction"], required: true },
    quantity: { type: Number, required: true }, // For non-serialized
    serial_numbers: [String], // For serialized
    reference: { type: String }, // e.g., "Purchase", "Sale", "Repair"
    date: { type: Date, default: Date.now },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Who made the change
  });

  
  module.exports = mongoose.model("StockMovement", stockMovementSchema);