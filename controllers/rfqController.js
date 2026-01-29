const RequestForQuotation = require('../models/RequestForQuotation');

// GET: Fetch all RFQs
exports.getAllRFQs = async (req, res) => {
    try {
        const rfqs = await RequestForQuotation.find()
            .populate('supplier', 'business_name contact_info')
            .sort({ createdAt: -1 });
        res.json(rfqs);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching RFQs', error: error.message });
    }
};

// POST: Create a new RFQ (Draft)
exports.createRFQ = async (req, res) => {
    try {
        const newRFQ = new RequestForQuotation(req.body);
        const savedIRQ = await newRFQ.save();
        res.status(201).json(savedIRQ);
    } catch (error) {
        res.status(400).json({ message: 'Error creating RFQ', error: error.message });
    }
};

// PUT: Update an RFQ (Items, status, notes)
exports.updateRFQ = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedRFQ = await RequestForQuotation.findByIdAndUpdate(
            id,
            req.body,
            { new: true } // Return updated doc
        ).populate('supplier', 'business_name contact_info');

        if (!updatedRFQ) return res.status(404).json({ message: 'RFQ not found' });

        res.json(updatedRFQ);
    } catch (error) {
        res.status(400).json({ message: 'Error updating RFQ', error: error.message });
    }
};

// DELETE: Remove an RFQ
exports.deleteRFQ = async (req, res) => {
    try {
        const { id } = req.params;
        await RequestForQuotation.findByIdAndDelete(id);
        res.json({ message: 'RFQ deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting RFQ', error: error.message });
    }
};

// PATCH: Update Status (Quick Action)
exports.updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const rfq = await RequestForQuotation.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );

        if (!rfq) return res.status(404).json({ message: 'RFQ not found' });
        res.json(rfq);
    } catch (error) {
        res.status(500).json({ message: 'Error updating status', error: error.message });
    }
};
