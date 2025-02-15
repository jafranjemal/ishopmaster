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
    
  },
});

phoneModelSchema.index({ model_name: 1, brandId: 1 }, { unique: true });
const PhoneModel = mongoose.model('PhoneModel', phoneModelSchema);
module.exports = PhoneModel;
