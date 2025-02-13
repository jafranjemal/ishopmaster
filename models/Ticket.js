const mongoose = require("mongoose");

const TicketSchema = new mongoose.Schema({
  ticketNumber: { type: String, unique: true,}, 
  customerID: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
  deviceID: { type: mongoose.Schema.Types.ObjectId, ref: "Device", required: true },
  deviceInspectionId: { type: mongoose.Schema.Types.ObjectId, ref: "DeviceInspection", required: false },
  reportedIssues: [{ type: String, required: true }], 
  technicianFindings: [{ type: String }], 
  estimatedCost: { type: Number, required: true }, 
  finalCost: { type: Number }, 
  estimatedTime: { type: Number, required: true }, 
  finalTime: { type: Number }, 
  troubleshootingFee: { type: Number, default: 0 },
  technicianID: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: false }, 
  repairNotes: { type: String }, 
  createdAt: { type: Date, default: Date.now },

  repairStatus: {
    type: String,
    enum: [
      "New",                   // Customer created ticket
      "Customer Approval",      // Waiting for customer to approve cost
      "Technician Assigned",    // Technician assigned, waiting for work to start
      "In Progress",            // Technician is working
      "Admin Approval",         // Work completed, waiting for admin review
      "Completed",              // Admin verified, repair finished
      "Rejected",               // Customer rejected repair
      "Cancelled",              // Repair canceled (by customer or admin)
    ],
    default: "New",
  }
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
module.exports = Ticket


 