const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
  item_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Item",
    required: true,
  },

  _id: { type: String, required: true },
  barcode: { type: String, required: true },
  batch_number: { type: String, required: function () { return !this.isSerialized; } },
  itemName: { type: String, required: true },
  itemImage: { type: String, required: false },
  quantity: { type: Number, required: true },
  discount: { type: Number, required: false, default: 0 },
  lastSellingPrice: { type: Number, required: false },
  price: { type: Number, required: true },
  totalPrice: { type: Number, required: true }, // Total price for the quantity sold
  serialNumbers: { type: [String], required: false }, // Array of serial numbers if applicable
  isSerialized: { type: Boolean, default: false }, // Flag to indicate if the item is serialized
});

const TicketSchema = new mongoose.Schema({
  ticketNumber: { type: String, unique: true },
  customerID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    required: true,
  },
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SalesInvoice",
    required: false,
  },
  deviceID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Device",
    required: true,
  },
  deviceInspectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "DeviceInspection",
    required: false,
  },
  reportedIssues: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReportedIssue",
      required: false, // Changed to false to support new string-based reportedIssues
    },
  ],
  technicianFindings: [{ type: String }],
  estimatedCost: { type: Number, required: true },
  finalCost: { type: Number },
  estimatedTime: { type: String, required: true },
  finalTime: { type: String },
  blockingReason: {
    type: String,
    enum: ["None", "Parts", "Technician", "Customer", "Admin", "Partner Delay"],
    default: "None"
  },
  statusAging: [
    {
      status: { type: String },
      enteredAt: { type: Date, default: Date.now },
      exitedAt: { type: Date },
      durationMinutes: { type: Number }
    }
  ],
  extraCharge: { type: Number, default: 0 },
  isCustomerApproved: { type: Boolean, default: false },
  serviceItems: [
    {
      serviceItemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ServiceItem",
      },
      quantity: { type: Number, default: 1 },
      name: { type: String, required: true },
      icon: { type: String, required: false },
      model_name: { type: String, required: false },
      labourCharge: { type: Number, default: 0 },
      duration: { type: String },
      commission: { type: Number, default: 0 },
      price: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      warranty: {
        type: Number,
        default: 0, // Model name (e.g., "iPhone 14 Pro Max")
      },
      warrantyUnit: {
        type: String,
        default: "Days", // Model name (e.g., "iPhone 14 Pro Max")
      },
      associatedParts: [
        {
          partId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Item",

          },

          _id: { type: String, },
          partCost: { type: String, },
          itemName: { type: String, },
          itemImage: { type: String, required: false },
          quantity: { type: Number, },
          discount: { type: Number, required: false, default: 0 },
          lastSellingPrice: { type: Number, required: false },
          price: { type: Number, },
          totalPrice: { type: Number, }, // Total price for the quantity sold
          serialNumbers: { type: [String], required: false }, // Array of serial numbers if applicable
          isSerialized: { type: Boolean, default: false }, // Flag to indicate if the item is serialized
        }
      ],
      modelId: { type: mongoose.Schema.Types.ObjectId, ref: "PhoneModel" },
    },
  ],
  inventoryItems: [itemSchema],
  troubleshootingFee: { type: Number, default: 0 },

  technicianID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employees",
    required: false,
  },
  repairNotes: { type: String },
  updateNote: { type: String },
  createdAt: { type: Date, default: Date.now },

  // TOON ENHANCEMENTS
  ticketStatus: {
    type: String,
    enum: ["Open", "In Progress", "Completed", "Cancelled"],
    default: "Open",
  },
  repairStatus: {
    type: String,
    enum: [
      "New",
      "Customer Approval",
      "Technician Assigned",
      "In Progress",
      "Admin Approval",
      "Quality Check", // Added for TOON
      "Ready for Pickup", // Added for TOON
      "Completed",
      "Rejected",
      "Cancelled",
    ],
    default: "New",
  },
  statusHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  }],
  qualityControl: {
    technicianID: { type: mongoose.Schema.Types.ObjectId, ref: "Employees" },
    checksPassed: [String],
    updateNote: String,
    completedAt: Date
  },
  payments: [{
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "SalesInvoice" },
    amount: { type: Number, required: true },
    type: { type: String, enum: ["Deposit", "Final Payment", "Partial"], default: "Deposit" },
    date: { type: Date, default: Date.now },
    method: { type: String } // 'Cash', 'Card', etc.
  }],
  paidAmount: { type: Number, default: 0 },
  dueAmount: { type: Number, default: 0 }
});

async function generateTicketId() {
  const lastTicket = await this.constructor.findOne().sort("-createdAt");
  const currentId = lastTicket
    ? parseInt(lastTicket.ticketNumber.replace("TICKET-", ""), 10)
    : 0;
  const newId = currentId + 1;
  return `TICKET-${String(newId).padStart(6, "0")}`;
}

TicketSchema.pre("save", async function (next) {
  if (!this.isNew) return next(); // Skip if the document is not new

  try {
    this.ticketNumber = await generateTicketId.call(this);
    next();
  } catch (error) {
    next(error);
  }
});

const Ticket = mongoose.model("Ticket", TicketSchema);
module.exports = Ticket;
