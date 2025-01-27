const mongoose = require("mongoose");

const salesInvoiceSchema = new mongoose.Schema(
  {
    customerID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer', // Reference to the customer making the purchase
      required: true,
    },
    invoiceDate: {
      type: Date,
      default: Date.now, // Default to current date
    },
    totalAmount: {
      type: Number,
      required: true, // Total amount for the invoice
    },
    paymentStatus: {
      type: String,
      enum: ['paid', 'unpaid', 'partially paid'], // Options for payment status
      default: 'unpaid', // Default to unpaid
    },
    paymentMethods: [
        {
          method: {
            type: String,
            enum: ['cash', 'card', 'bank transfer', 'online'], // Payment methods options
            required: true,
          },
          amount: {
            type: Number,
            required: true, // Amount paid through this payment method
          },
          transactionID: { type: String }, // Transaction ID (for online or bank payments)
          paymentDate: {
            type: Date,
            default: Date.now, // Payment date for each method
          },
        },
      ],
    paymentDate: {
      type: Date,
      required: function () {
        return this.paymentStatus === 'paid' || this.paymentStatus === 'partially paid'; // Payment date only if paid or partially paid
      },
    },
    items: [
      {
        itemID: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Item', // Reference to the item being sold
          required: true,
        },
        quantity: {
          type: Number,
          required: true, // Quantity of the item sold
        },
        price: {
          type: Number,
          required: true, // Unit price of the item
        },
        discount: {
          type: Number,
          default:0, // Unit price of the item
        },
        totalPrice: {
          type: Number,
          required: true, // Total price for the item (price * quantity)
          default: function () {
            return (this.price * this.quantity ) - this.discount; // Calculate total price
          },
        },
        isSerialized:{
type:Boolean,
default: function () {
    return this.itemID.serialized // Only if the item is serialized
  },
        },
        serializedItems: [
          {
            serialNumber: {
              type: String, // Unique serial number for serialized items
              required: function () {
                return this.itemID.serialized === true; // Only if the item is serialized
              },
            },
            // sellingPrice: {
            //   type: Number,
            //   required: true, // Selling price for each serialized item
            // },
          },
        ],
      },
    ],
    discount: {
      type: Number,
      default: 0, // Default to 0
      min: [0, 'Discount cannot be negative'], // Ensure no negative discount
    },
    tax: {
      type: Number,
      default: 0, // Default to 0
    },
    dueDate: {
      type: Date, // Due date for payment
    },
    employeeCommission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employees', // Reference to the employee who made the sale
    },
    commissionAmount: {
      type: Number,
      required: true, // Commission amount for the employee
      default: 0,
    },
    remarks: {
      type: String, // Additional notes or comments
    },
    createdAt: {
      type: Date,
      default: Date.now, // Record creation time
    },
    updatedAt: {
      type: Date, // Record the last update time
      default: Date.now,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

const SalesInvoice = mongoose.model('SalesInvoice', salesInvoiceSchema);
module.exports = SalesInvoice;
