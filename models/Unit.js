// models/Unit.js

const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema({
  name: { type: String, required: true, unique:true },
  description: { type: String, required: false },
  symbol: { type: String, required: false, unique:true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Unit', unitSchema);
