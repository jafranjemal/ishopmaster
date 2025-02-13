const mongoose = require('mongoose');

const phoneModelSchema = new mongoose.Schema({
  
    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Brand',
      required: true
    },
  model_name: {
    type: String,
    required: true,
  },
  image_url: {
    type: String,
    required: true,
  },
});

const PhoneModel = mongoose.model('PhoneModel', phoneModelSchema);

module.exports = PhoneModel;
