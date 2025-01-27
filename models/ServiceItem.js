const mongoose = require('mongoose');
const { Schema } = mongoose;

// Service Item Schema
const serviceItemSchema = new Schema(
  {
    serviceItemID: {
      type: String,
      required: true,
      unique: true, // Unique identifier for the service item
    },
    name: {
      type: String,
      required: true, // Name of the service (e.g., "iPhone 15 Series Display Replacement")
    },
    description: {
      type: String,
      required: true, // Detailed description of the service
    },
    price: {
      type: Number,
      required: true, // Total price of the service (may include service charge and labor)
    },
    laborCharge: {
      type: Number,
      required: true, // Labor charge specific to this service item
    },
    duration: {
      type: String,
      required: true, // Estimated time required to complete the service (e.g., "2 hours")
    },
    associatedParts: [
      {
        partName: {
          type: String,
          required: true, // Name of the part (e.g., display, adhesive)
        },
        partCost: {
          type: Number,
          required: true, // Cost of the part
        },
        quantity: {
          type: Number,
          required: true, // Quantity required for the service
        },
      },
    ],
    category: {
      type: String,
      required: true, // Type of service (e.g., "Display Replacement", "Battery Replacement")
    },
    createdAt: {
      type: Date,
      default: Date.now, // Date and time when the service item was created
    },
    updatedAt: {
      type: Date,
      default: Date.now, // Last time the service item was updated
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active', // Service item status (Active/Inactive)
    },
  },
  {
    timestamps: true, // Automatically add createdAt and updatedAt
  }
);

module.exports = mongoose.model('ServiceItem', serviceItemSchema);
