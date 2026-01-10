const mongoose = require('mongoose');

const DeviceInspectionSchema = new mongoose.Schema({
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },

  condition: {
    bodyCondition: String,
    screenCondition: String,
    batteryHealth: Number,
    waterDamage: Boolean,
    previousRepairs: [String],

    accessoriesReceived: [{
      item: String,
      condition: String,
      returned: { type: Boolean, default: false }
    }],

    securityLock: {
      type: { type: String, enum: ['None', 'PIN', 'Pattern', 'Password', 'FaceID', 'Fingerprint'], default: 'None' },
      code: String
    }
  },

  issues: {
    reportedIssues: [String],
    diagnosedIssues: [String],
    urgency: { type: String, enum: ['low', 'normal', 'high', 'urgent'] },
    estimatedRepairTime: String,
    isHighRisk: { type: Boolean, default: false } // Flag for high-risk repairs (e.g. unlocking)
  },

  photos: [{
    url: String,
    publicId: String,
    timestamp: Date,
    type: { type: String } // Fixed: Explicit definition to avoid Mongoose casting to [String]
  }],

  assessment: {
    inspectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employees' },
    inspectionDate: Date,
    notes: String,
    recommendedServices: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ServiceItem' }]
  },

  status: {
    type: String,
    enum: ['Intake', 'Diagnosing', 'Waiting for Parts', 'Pending Approval', 'Approved', 'Repaired', 'Completed', 'Cancelled'],
    default: 'Intake'
  },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DeviceInspection', DeviceInspectionSchema);
