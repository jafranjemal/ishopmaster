const mongoose = require("mongoose");

/**
 * Generates a unique customer ID.
 * 
 * @returns {string} A unique customer ID in the format 'CUS-XXXXXX'.
 */
async function generateCustomerId() {
  const lastCustomer = await this.constructor.findOne({
    customer_id: /^CUS-\d+$/
  }).sort({ customer_id: -1 });

  let currentId = 0;
  if (lastCustomer && lastCustomer.customer_id) {
    const numericPart = lastCustomer.customer_id.match(/\d+/);
    if (numericPart) {
      currentId = parseInt(numericPart[0], 10);
    }
  }

  const newId = currentId + 1;
  return `CUS-${String(newId).padStart(6, "0")}`;
}


const customerSchema = new mongoose.Schema({
  first_name: { type: String, required: true },
  customer_id: { type: String, unique: true },
  last_name: { type: String, required: false },
  email: { type: String, required: false },
  phone_number: { type: String, required: true },
  address: { type: String, required: false },
  customer_type: {
    type: String,
    enum: ["Individual", "Business"],
    default: 'Individual'

  },
  company_name: { type: String },  // Optional, if customer is a business
  customer_image: { type: String },  // Optional, if customer is a business
  company_tax_id: { type: String },  // Optional, if customer is a business
  creditLimit: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

customerSchema.pre("save", async function (next) {
  if (!this.isNew) return next(); // Skip if the document is not new

  try {
    this.customer_id = await generateCustomerId.call(this);
    next();
  } catch (error) {
    next(error);
  }

});
const Customer = mongoose.model("Customer", customerSchema);
module.exports = Customer;
