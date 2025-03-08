const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
    item_id: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
     
    _id: { type: String, required: true },
    barcode: { type: String, required: true },
    itemName: { type: String, required: true },
    batch_number:  { type: String, required: true },
    itemImage: { type: String, required: false },
    quantity: { type: Number, required: true },
    discount: { type: Number, required: false , default:0},
    lastSellingPrice: { type: Number, required: false },
    price: { type: Number, required: true },
    totalPrice: { type: Number, required: true }, // Total price for the quantity sold
    serialNumbers: { type: [String], required: false }, // Array of serial numbers if applicable
    isSerialized: { type: Boolean, default: false }, // Flag to indicate if the item is serialized
});

const paymentMethodSchema = new mongoose.Schema({
    method: { type: String, enum: ["Account","Cash", "Card", "Cheque", "Bank Transfer"], required: true },
    amount: { type: Number, required: true }, // Amount paid via this method
    details: {
        cheque_number: { type: String },
        bank_account_name: { type: String },
        account_number: { type: String },
        card_details: {
            card_holder_name: { type: String },
            card_last_4_digits: { type: String },
        },
    },
});

const salesInvoiceSchema = new mongoose.Schema({
    invoice_id: { type: String, unique: true }, // Unique invoice identifier
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true }, // Reference to the customer
    items: [itemSchema], // Array of items sold
    total_amount: { type: Number, required: true }, // Total amount for the invoice
    total_paid_amount: { type: Number, required: true }, // Total amount for the invoice
    total_over_paid_amount: { type: Number, required: false }, // Total amount for the invoice
    payment_methods: [paymentMethodSchema], // Array of payment methods used
    transaction_type: { 
        type: String, 
        enum: ["Sale", "Return", "Refund","Reversed"], 
        required: true 
    }, // Type of transaction
    shift_id: { type: mongoose.Schema.Types.ObjectId, ref: "Shift", required: true }, // Reference to the shift
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User ", required: true }, // Reference to the user processing the sale
    invoice_date: { type: Date, default: Date.now }, // Date of the invoice
    status: { 
        type: String, 
        enum: ["Paid", "Unpaid", "Partially paid", "Reversed"], 
        default: "Unpaid" 
    }, // Status of the invoice
    notes: { type: String, required: false }, // Optional notes for the invoice


    //service sales
    invoice_type:{
      type: String,
      enum:['Sale', 'Service'],
      default:'Sale'
    },
    serviceItems:[],
    ticketId:{
      type:mongoose.Types.ObjectId,
      ref:'Ticket'
    },



    
}, {
  timestamps : true
});

async function generateInvoiceId() {
    const lastInvoice = await this.constructor.findOne().sort("-_id");
    //let currentId = 0;

  // if (lastInvoice && lastInvoice.invoice_id) {
  //   const invoiceId = lastInvoice.invoice_id.replace("INV-", "");
  //   if (!isNaN(invoiceId)) {
  //     currentId = parseInt(invoiceId, 10);
  //   }
  // }

  const currentId = lastInvoice
  ? parseInt(lastInvoice.invoice_id.replace("INV-", ""), 10)
  : 0;
    
    const newId = currentId + 1;
    return `INV-${String(newId).padStart(6, "0")}`;
  }

  salesInvoiceSchema.pre("save", async function (next) {
    if (!this.isNew) return next(); // Skip if the document is not new
  
    try {
      this.invoice_id = await generateInvoiceId.call(this);
      next();
    } catch (error) {
      next(error);
    }
  });

    
 

const SalesInvoice = mongoose.model("SalesInvoice", salesInvoiceSchema);
module.exports = SalesInvoice;