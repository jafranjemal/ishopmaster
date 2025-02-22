const mongoose = require('mongoose');

const deviceInspectionSchema = new mongoose.Schema(
  {
    deviceID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      required: true, // Reference to the repair order
    },
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
       // Reference to the repair order
    },
    inspectionDate: {
      type: Date,
      default: Date.now, // Date of inspection
    },
    batteryCondition: {
      type: String, // E.g., "Good", "Replace", "Drained"
      enum: ['Good', 'Replace', 'Drained', 'Needs Attention', 'Not Tested'], // Possible values for battery condition
    },
    homeButtonCondition: {
      type: String, // E.g., "Good", "Replace", "Drained"
      enum: ['Good', 'Needs Attention', 'Not Tested'], // Possible values for battery condition
    },
   fingerPrintCondition: {
      type: String, // E.g., "Good", "Replace", "Drained"
      enum: ['Good', 'Needs Attention', 'Not Tested'], // Possible values for battery condition
    },
    screenCondition: {
      type: String, // E.g., "Cracked", "Good", "Scratched", "Dead Pixels"
      enum: ['Good', 'Cracked', 'Scratched', 'Dead Pixels', 'Burnt', 'Not Tested'], // Possible values for screen condition
    },
    frontCameraCondition: {
      type: String, // E.g., "Good", "Damaged", "Not Working"
      enum: ['Good', 'Damaged', 'Not Working', 'Not Tested'], // Possible values for front camera condition
    },
    rearCameraCondition: {
      type: String, // E.g., "Good", "Damaged", "Not Working"
      enum: ['Good', 'Damaged', 'Not Working', 'Not Tested'], // Possible values for rear camera condition
    },
    speakerCondition: {
      type: String, // E.g., "Good", "Distorted", "Not Working"
      enum: ['Good', 'Distorted', 'Not Working', 'Not Tested'], // Possible values for speaker condition
    },
    microphoneCondition: {
      type: String, // E.g., "Good", "Not Working"
      enum: ['Good', 'Not Working', 'Not Tested'], // Possible values for microphone condition
    },
    chargingPortCondition: {
      type: String, // E.g., "Good", "Loose", "Not Charging"
      enum: ['Good', 'Loose', 'Not Charging', 'Not Tested'], // Possible values for charging port condition
    },
    headphoneJackCondition: {
      type: String, // E.g., "Good", "Loose", "Not Working"
      enum: ['Good', 'Loose', 'Not Working', 'Not Tested'], // Possible values for headphone jack condition
    },
    powerButtonCondition: {
      type: String, // E.g., "Good", "Sticky", "Not Working"
      enum: ['Good', 'Sticky', 'Not Working', 'Not Tested'], // Possible values for power button condition
    },
    volumeButtonCondition: {
      type: String, // E.g., "Good", "Loose", "Not Working"
      enum: ['Good', 'Loose', 'Not Working', 'Not Tested'], // Possible values for volume button condition
    },
    muteSwitchCondition: {
      type: String, // E.g., "Good", "Not Working", "Sticky"
      enum: ['Good', 'Not Working', 'Sticky', 'Not Tested'], // Possible values for mute switch condition
    },
    screenOrientation: {
      type: String, // E.g., "Landscape", "Portrait", or "Auto"
      enum: ['Landscape', 'Portrait', 'Auto', 'Not Tested'], // Screen orientation condition
    },
    deviceFrameCondition: {
      type: String, // E.g., "Scratched", "Bent", "Cracked"
      enum: ['Scratched', 'Bent', 'Cracked', 'Good', 'Not Tested'], // Device frame condition
    },
    waterDamage: {
      type: Boolean, // Whether the device has water damage
      default: false,
    },
    glassBackCondition: {
      type: String, // E.g., "Cracked", "Scratched", "Good"
      enum: ['Good', 'Cracked', 'Scratched', 'Not Tested'], // Glass back condition for certain phones (e.g., iPhone 8 and above)
    },
    sensorCondition: {
      type: String, // E.g., "All sensors working", "Gyroscope not working", etc.
      enum: ['All sensors working', 'Gyroscope not working', 'Accelerometer not working', 'Not Tested'], // Sensor condition
    },
    deviceNotes: {
      type: String, // Any additional notes for the inspection
    },
    images:[

    ],
    inspectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employees', // Reference to the employee who performed the inspection
    },
  },
  {
    timestamps: true, // Automatically add createdAt and updatedAt timestamps
  }
);

const DeviceInspection = mongoose.model('DeviceInspection', deviceInspectionSchema);
module.exports = DeviceInspection;
