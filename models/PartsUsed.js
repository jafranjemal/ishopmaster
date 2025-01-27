const mongoose = require('mongoose');

const partsUsedSchema = new mongoose.Schema({
  partNumber: {
    type: String,
    required: true
  },
  partName: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  repairOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RepairOrder',
    required: true
  }
});

const PartsUsed = mongoose.model('PartsUsed', partsUsedSchema);
module.exports = PartsUsed;
