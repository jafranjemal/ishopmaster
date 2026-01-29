const mongoose = require("mongoose");

const BarcodeTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  isContinuous: {
    type: Boolean,
    required: true,
    default: false, // Whether it's a continuous feed or sheet-based
  },
  topMargin: {
    type: Number,
    required: true,
    default: 0, // In inches
  },
  leftMargin: {
    type: Number,
    required: true,
    default: 0, // In inches
  },
  stickerWidth: {
    type: Number,
    required: true, // Width of a single sticker (in inches)
  },
  stickerHeight: {
    type: Number,
    required: true, // Height of a single sticker (in inches)
  },
  paperWidth: {
    type: Number,
    required: true, // Width of the paper (in inches)
  },
  paperHeight: {
    type: Number,
    required: true, // Height of the paper (in inches)
  },
  stickersInOneRow: {
    type: Number,
    required: true, // Number of stickers in a single row
  },
  rowDistance: {
    type: Number,
    required: true,
    default: 0, // Distance between two rows (in inches)
  },
  colDistance: {
    type: Number,
    required: true,
    default: 0, // Distance between two columns (in inches)
  },
  stickersInOneSheet: {
    type: Number,
    required: true, // Total stickers on one sheet
  },
  isDefault: {
    type: Boolean,
    default: false, // Whether this template is the default
  },
  showPrice: {
    type: Boolean,
    default: true,
  },
  showBatteryHealth: {
    type: Boolean,
    default: true,
  },
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Business", // Optional, to associate with a specific business
    default: null,
  },
}, { timestamps: true });

module.exports = mongoose.model("BarcodeTemplate", BarcodeTemplateSchema);
