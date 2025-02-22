const TicketService = require('../services/TicketService');

class TicketController {
  static async createTicket(req, res) {
    try {
      const ticketData = req.body;
      const newTicket = await TicketService.createTicket(ticketData);
      res.status(201).json(newTicket);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  static async updateTicketStatus(req, res) {
    try {
      const { ticketID, newStatus, technicianID, troubleshootingFee } = req.body;
      const updatedTicket = await TicketService.updateTicketStatus(ticketID, newStatus, technicianID, troubleshootingFee);
      res.status(200).json(updatedTicket);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
}

module.exports = TicketController;