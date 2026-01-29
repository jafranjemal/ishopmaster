const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Phone', 'Laptop', 'Tablet', 'Other'],
    required: true
  },

  serialNumber: { type: String, unique: true, required: true }, // IMEI/Serial

  color: { type: String },
  storage: { type: String },
  RAM: { type: String },
  network: { type: String }, // 4G, 5G
  source: { type: String, enum: ['Sales', 'ThirdParty'], default: 'ThirdParty' },
  purchaseDate: { type: Date },
  passwordType: { type: String, default: 'text' }, // Should be encrypted
  password: { type: String, required: false }, // Should be encrypted



  brandId: {
    type: String,
    ref: 'Brand',
    required: true
  },
  modelId: {
    type: String,
    ref: 'PhoneModel',
    required: true

  },

  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  }
}, {
  timestamps: true
});

const Device = mongoose.model('Device', deviceSchema);
module.exports = Device;
