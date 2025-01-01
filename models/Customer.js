const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema({
  first_name: { type: String, required: true },
  last_name: { type: String, required: true },
  email: { type: String, required: false },
  phone_number: { type: String, required: true },
  address: { type: String, required: false },
  customer_type: { 
    type: String, 
    enum: ["Individual", "Business"], 
    default:'Individual'
    
  },
  company_name: { type: String },  // Optional, if customer is a business
  customer_image: { type: String },  // Optional, if customer is a business
  company_tax_id: { type: String },  // Optional, if customer is a business
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

const Customer = mongoose.model("Customer", customerSchema);
module.exports = Customer;
