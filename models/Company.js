const mongoose = require("mongoose");

const companySchema = new mongoose.Schema({
  company_name: { type: String, required: true },
  company_type: { 
    type: String, 
    enum: ["LLC", "Sole Proprietorship", "Corporation", "Partnership", "Other","Retail"], 
    required: true 
  },
  contact_person: { type: String, required: true },
  email: { type: String, required: true },
  phone_number: { type: String, required: true },
  address: { type: String, required: true },
  tax_id: { type: String },  // Optional, for tax identification
  registration_number: { type: String },  // Optional, for legal purposes
  company_logo: { type: String },  // Optional, for legal purposes
  company_fb_link: { type: String },  // Optional, for legal purposes
  company_instagram_link: { type: String },  // Optional, for legal purposes
  company_tiktok_link: { type: String },  // Optional, for legal purposes
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

const Company = mongoose.model("Company", companySchema);
module.exports = Company;
