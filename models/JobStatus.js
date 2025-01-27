const mongoose = require('mongoose');

const jobStatusSchema = new mongoose.Schema({
  repairOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RepairOrder',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'delivered'],
    default: 'pending'
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const JobStatus = mongoose.model('JobStatus', jobStatusSchema);
module.exports = JobStatus;
