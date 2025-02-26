const express = require("express");
const TicketService = require("../services/TicketService");

const router = express.Router();

// Create a new ticket
router.post("/", async (req, res) => {
  try {
    const ticket = await TicketService.createTicket(req.body);
    res.status(201).json(ticket);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get all tickets
router.get("/", async (req, res) => {
  try {
    const tickets = await TicketService.getAllTickets();
    res.status(200).json(tickets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a single ticket by ID
router.get("/:ticketId", async (req, res) => {
  try {
    const ticket = await TicketService.getTicketById(req.params.ticketId);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    res.status(200).json(ticket);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a ticket
router.put("/:ticketId", async (req, res) => {
  try {
    const updatedTicket = await TicketService.updateTicket(req.params.ticketId, req.body);
    if (!updatedTicket) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    res.status(200).json(updatedTicket);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
// Update a ticket
router.put("/:ticketId/ticket-status/:status", async (req, res) => {
  try {
    const updatedTicket = await TicketService.updateTicketStatus(req.params.ticketId,req.params.status);
    if (!updatedTicket) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    res.status(200).json(updatedTicket);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
router.put("/:ticketId/repair-status/:status", async (req, res) => {
  try {
    const updatedTicket = await TicketService.updateTicketRepairStatus(req.params.ticketId,req.params.status);
    if (!updatedTicket) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    res.status(200).json(updatedTicket);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete a ticket
router.delete("/:ticketId", async (req, res) => {
  try {
    const deletedTicket = await TicketService.deleteTicket(req.params.ticketId);
    if (!deletedTicket) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    res.status(200).json({ message: "Ticket deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
