const mongoose = require('mongoose');

// Function to generate unique supplier ID
async function generateSupplierId() {
  const lastSupplier = await this.constructor.findOne().sort("-createdAt");
  const currentId = lastSupplier
    ? parseInt(lastSupplier.supplier_id.replace("SUP-", ""), 10)
    : 0;
  const newId = currentId + 1;
  return `SUP-${String(newId).padStart(6, "0")}`;
}

const supplierSchema = new mongoose.Schema({
  supplier_id: { type: String, unique: true }, //need to generate before add supplier
  business_name: { type: String, required: true },
  contact_person: { type: String },
  address: {
    address_line1: { type: String, required: true },
    address_line2: { type: String },
    city: { type: String, required: true },
    state: { type: String },
    country: { type: String, required: true },
    postal_code: { type: String },
  },

  // Agent Registry
  contacts: [{
    name: { type: String, required: true },
    designation: { type: String }, // e.g. "Oppo Rep"
    phone: { type: String },
    email: { type: String },
    isPrimary: { type: Boolean, default: false }
  }],

  contact_info: {
    contact_number: { type: String, required: true },
    alternate_contact_number: { type: String },
    email: { type: String, required: false },
    website: { type: String },
  },
  tax_info: {
    tax_number: { type: String },
    registration_number: { type: String },
  },
  financial: {
    opening_balance: { type: Number, default: 0 },
    current_balance: { type: Number, default: 0 },
    credit_limit: { type: Number, default: 0 },
    credit_period: { type: String },
    payment_terms: { type: String },
    custom_credit_period: { type: Number, default: 0 },
    // Master Distributor Logic
    credit_segments: [{
      name: { type: String, required: true }, // e.g. "Oppo", "Samsung"
      limit: { type: Number, default: 0 },
      utilized: { type: Number, default: 0 },
      agent_id: { type: mongoose.Schema.Types.ObjectId } // Optional link to specific agent
    }]
  },
  bank_details: {
    bank_name: { type: String },
    bank_account_number: { type: String },
    bank_routing_number: { type: String },
    SWIFT_code: { type: String },
  },
  logo_image: { type: String },
  notes: { type: String },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

}, { timestamps: true });




supplierSchema.pre("save", async function (next) {
  if (!this.isNew) return next(); // Skip if the document is not new

  try {
    this.supplier_id = await generateSupplierId.call(this);
    next();
  } catch (error) {
    next(error);
  }

});



module.exports = mongoose.model("Supplier", supplierSchema);


