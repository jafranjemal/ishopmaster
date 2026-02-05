// Brands Schema (models/Brand.js)
const mongoose = require("mongoose");

const brandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, default: "" },
    image: { type: String }, // URL of the brand logo or image

  },
  { timestamps: true }
);

brandSchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.name = this.name.toUpperCase();
  }
  next();
});

const Brand = mongoose.model("Brand", brandSchema);
module.exports = Brand
