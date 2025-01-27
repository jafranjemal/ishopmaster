const mongoose = require("mongoose");
const {  generatePaymentId } = require("../utility");

// const paymentSchema = new mongoose.Schema({
//   payment_method: {
//     type: String,
//     enum: ["Cash", "Card", "Cheque", "Bank Transfer"],
//     required: true,
//   },
//   amount: { 
//     type: Number, 
//     required: true 
//   },
//   payment_date: {
//     type: Date,
//     required: true,
//     default: Date.now,
//   },
//   from_account_id: { 
//     type: mongoose.Schema.Types.ObjectId, 
//     ref: "Account", 
//     required: true 
//   },
//   transaction_type: {
//     type: String,
//     enum: ["Deposit", "Withdrawal"],
//     default:"Deposit"
//   },
//   reason: { 
//     type: String, 
//     required: true 
//   },
//   to_account_id: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "Account", // Refers to the recipient of the payment (Customer/Supplier/Company Account)
//     required: false, // Not always required (only when applicable)
//   },
//   cheque_number: { 
//     type: String, 
//     required: false 
//   },
//   card_details: { 
//     type: String, 
//     required: false 
//   },
//   balance_after_payment: { 
//     type: Number, 
//     required: false 
//   },
// });

// const Payment = mongoose.model("Payment", paymentSchema);

// module.exports = Payment;


const paymentSchema = new mongoose.Schema({
    payment_id: { type: String, unique: true },
    from_account_id: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Account", 
      required: true,
    },
    to_account_id: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Account", 
      required: true,
    },
    amount: { type: Number, required: true },
    payment_methods: [
      {
        method: { type: String, enum: ["Cash", "Card", "Cheque", "Bank Transfer"], required: true },
        details: {
          cheque_number: { type: String },
          bank_account_name: { type: String },
          card_details: {
            card_holder_name: { type: String },
            card_last_4_digits: { type: String },
          },
        },
        amount: { type: Number, required: true }, // Amount paid via this method
      },
    ],
    transaction_type: { 
      type: String, 
      enum: ["Supplier Payment", "Employees Payment", "Sale", "Refund", "Deposit", "Withdrawal", "Other"], 
      required: true,
    },
    references: { 
        supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: false }, // Only for supplier-related payments 
        employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employees", required: false }, // For salary-related payments 
        customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: false }, // For refund-related payments 
        purchase_orders: [ { purchase_id: { type: mongoose.Schema.Types.ObjectId, ref: "Purchase", required: false }, paidAmount: { type: Number, required: false } }, ], 
        sale: { type: mongoose.Schema.Types.ObjectId, ref: "SalesInvoice", required: false }, // Optional reference to a sale if walk-in payment or regular sale 
    }, 
    walkin_payment: { type: Boolean, default: false }, // Flag for walk-in customer payments
    description: { type: String ,required: true },
    transaction_date: { type: Date, default: Date.now },
  });
  
  paymentSchema.pre('save', function(next) { 
    if (!this.payment_id) 
        { this.payment_id = generatePaymentId('PAY'); } 
    next(); });

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = Payment;