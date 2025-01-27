const mongoose = require('mongoose');

const repairOrderSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  device: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    required: true
  },
  receivedDate: {
    type: Date,
    default: Date.now
  },
  expectedCompletionDate: Date,
  serviceItems: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceItem'
  }],
  partsUsed: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PartsUsed'
  }],
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'delivered'],
    default: 'pending'
  },
  totalAmount: Number,
  paymentStatus: {
    type: String,
    enum: ['paid', 'unpaid'],
    default: 'unpaid'
  }
});

const RepairOrder = mongoose.model('RepairOrder', repairOrderSchema);
module.exports = RepairOrder;
