const Ticket = require("../models/Ticket");
const Device = require("../models/Device");
const Customer = require("../models/Customer");
const Employee = require("../models/Employee");

class TicketService {
  // Create a new ticket
  static async createTicket(ticketData) {
    try {
      const {
        deviceInspectionId,
        customerID,
        deviceID,
        reportedIssues,
        technicianFindings,
        estimatedCost,
        finalCost,
        estimatedTime,
        finalTime,
        troubleshootingFee,
        technicianID,
        repairNotes,
        deviceData,
      } = ticketData;

      // Check if customer exists
      const customer = await Customer.findById(customerID);
      if (!customer) {
        throw new Error("Customer not found");
      }

      // Check if device exists
      const device = await Device.findById(deviceID);
      if (!device) {
        device = new Device({
          // Optional field
          status: "Active",
          type: deviceData.type,
          serialNumber: deviceData.serialNumber, // IMEI/Serial
          color: deviceData.color,
          storage: deviceData.storage,
          RAM: deviceData.RAM,
          network: deviceData.network, // :4GdeviceData.//, 5G
          purchaseDate: deviceData.purchaseDate,
          password: deviceData.password, // Should be encrypted

          brand: deviceData.brand,
          model: deviceData.model,

          owner: customerID,
        });
        await device.save();
      }

      // Generate a ticket number (unique ID or custom format)

      // Create a new ticket
      const newTicket = new Ticket({
        deviceInspectionId,
        customerID,
        deviceID,
        reportedIssues,
        technicianFindings,
        estimatedCost,
        finalCost,
        estimatedTime,
        finalTime,
        troubleshootingFee,
        technicianID,
        repairNotes,
        repairStatus, // Set initial status as 'New'
      });

      await newTicket.save();
      return newTicket;
    } catch (error) {
      throw new Error(`Error creating ticket: ${error.message}`);
    }
  }

  // Update ticket status
  static async updateTicketStatus(
    ticketID,
    newStatus,
    technicianID = null,
    troubleshootingFee = 0
  ) {
    try {
      // Find the ticket
      let ticket = await Ticket.findById(ticketID);
      if (!ticket) {
        throw new Error("Ticket not found");
      }

      // Handle specific status logic
      switch (newStatus) {
        case "Customer Approval":
          ticket.repairStatus = "Customer Approval";
          break;
        case "Technician Assigned":
          ticket.repairStatus = "Technician Assigned";
          ticket.technicianID = technicianID;
          break;
        case "In Progress":
          ticket.repairStatus = "In Progress";
          break;
        case "Admin Approval":
          ticket.repairStatus = "Admin Approval";
          break;
        case "Completed":
          ticket.repairStatus = "Completed";
          break;
        case "Rejected":
          ticket.repairStatus = "Rejected";
          ticket.troubleshootingFee = troubleshootingFee; // Apply troubleshooting fee
          break;
        case "Cancelled":
          ticket.repairStatus = "Cancelled";
          break;
        default:
          throw new Error("Invalid status update");
      }

      // Save updated ticket
      await ticket.save();
      return ticket;
    } catch (error) {
      throw new Error(`Error updating ticket status: ${error.message}`);
    }
  }

  // Add technician findings
  static async addTechnicianFindings(ticketID, findings) {
    try {
      // Find the ticket
      let ticket = await Ticket.findById(ticketID);
      if (!ticket) {
        throw new Error("Ticket not found");
      }

      // Add findings to the ticket
      ticket.technicianFindings.push(findings);
      await ticket.save();
      return ticket;
    } catch (error) {
      throw new Error(`Error adding technician findings: ${error.message}`);
    }
  }

  // Estimate the final cost after repair
  static async estimateFinalCost(ticketID, finalCost, finalTime) {
    try {
      // Find the ticket
      let ticket = await Ticket.findById(ticketID);
      if (!ticket) {
        throw new Error("Ticket not found");
      }

      // Update final cost and time
      ticket.finalCost = finalCost;
      ticket.finalTime = finalTime;

      // Update status if needed
      if (ticket.repairStatus !== "Completed") {
        ticket.repairStatus = "Admin Approval"; // Move to Admin approval when estimating cost
      }

      await ticket.save();
      return ticket;
    } catch (error) {
      throw new Error(`Error estimating final cost: ${error.message}`);
    }
  }

  // Get ticket details by ticket number
  static async getTicketByTicketNumber(ticketNumber) {
    try {
      const ticket = await Ticket.findOne({ ticketNumber })
        .populate("customerID")
        .populate("deviceID")
        .populate("technicianID");
      if (!ticket) {
        throw new Error("Ticket not found");
      }
      return ticket;
    } catch (error) {
      throw new Error(`Error fetching ticket: ${error.message}`);
    }
  }
}

module.exports = TicketService;
