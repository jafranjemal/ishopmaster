const mongoose = require('mongoose');

const workOrderSchema = new mongoose.Schema({
  workOrderID: {
    type: String,
    unique: true,
    required: true
  },
  customerID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  deviceID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    required: true
  },
  serviceItems: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceItem',
    required: true
  }],
  spareParts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PartsUsed'
  }],
  assignedEmployeeID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employees',
    required: true
  },
  status: {
    type: String,
    enum: ['In Progress', 'Completed', 'Waiting for Parts', 'Cancelled'],
    default: 'In Progress'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  scheduledCompletion: Date,  // The expected date and time of completion.
  totalEstimatedDuration: {
    type: Number,  // Duration in hours or minutes.
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid'],
    default: 'Pending'
  },
  remarks: String,  // Any additional notes or observations about the repair.
});

const WorkOrder = mongoose.model('WorkOrder', workOrderSchema);
module.exports = WorkOrder;
