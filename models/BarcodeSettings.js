const mongoose = require('mongoose');

const BarcodeSettingsSchema = new mongoose.Schema({
    settingName: { type: String, required: true },
  bcid: { type: String, default: 'code128' },
  text: { type: String, default: '' },
  scale: { type: Number, default: 3 },
  height: { type: Number, default: 20 },
  includetext: { type: Boolean, default: true },
  textxalign: { type: String, default: 'center' },
  textsize: { type: Number, default: 8 },
  backgroundcolor: { type: String, default: 'ffffff' },
  paddingtop: { type: Number, default: 5 },
  paddingbottom: { type: Number, default: 5 },
  textyoffset: { type: Number, default: 3 },
  itemNameFontSize: { type: Number, default: 12 },
  companyNameFontSize: { type: Number, default: 12 },
  priceFontSize: { type: Number, default: 12 },
  itemNameX: { type: String, default: '50%' },
  itemNameY: { type: String, default: '10' },
  companyNameX: { type: String, default: '90%' },
  companyNameY: { type: String, default: '100%' },
  priceX: { type: String, default: '5%' },
  priceY: { type: String, default: '100%' },
  paperType: { type: String, default: 'sheet' },
  pageSize: { type: String, default: 'A4' },
  rollWidth: { type: Number, default: 50 },
  labelWidth: { type: Number, default: 38 },
  labelHeight: { type: Number, default: 25 },
  padding: { type: Number, default: 2 },
  gap: { type: Number, default: 3 },
  gridColumns: { type: Number, default: 1 },
  orientation: { type: String, default: 'portrait' },
  printItems: { type: Array, default: [] },
});

const BarcodeSettings = mongoose.model('BarcodeSettings', BarcodeSettingsSchema);
module.exports = BarcodeSettings