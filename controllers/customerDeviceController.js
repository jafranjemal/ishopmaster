const CustomerDevice = require("../models/CustomerDevice");

/**
 * Get device by ID
 */
exports.getById = async (req, res) => {
    try {
        const device = await CustomerDevice.findById(req.params.id)
            .populate('owner', 'first_name last_name phone_number customer_id')
            .populate('brandId', 'name')
            .populate('modelId', 'name');

        if (!device) {
            return res.status(404).json({ message: "Device not found" });
        }

        res.json(device);
    } catch (error) {
        console.error("Error fetching device:", error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Check if device exists by serial number
 */
exports.checkSerial = async (req, res) => {
    try {
        const device = await CustomerDevice.findOne({ serialNumber: req.params.serial })
            .populate('owner', 'first_name last_name phone_number customer_id')
            .populate('brandId', 'name')
            .populate('modelId', 'name')
            .populate('itemId', 'itemName')
            .populate('variantId', 'variantName');

        res.json(device || null);
    } catch (error) {
        console.error("Error checking serial:", error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Create new device (for third-party repair intake)
 */
exports.create = async (req, res) => {
    try {
        const device = new CustomerDevice({
            ...req.body,
            source: req.body.source || 'ThirdParty',
            isExternalPurchase: req.body.source !== 'Sales'
        });

        await device.save();
        res.status(201).json(device);
    } catch (error) {
        console.error("Error creating device:", error);
        res.status(400).json({ message: error.message });
    }
};

/**
 * Get all devices owned by a customer
 */
exports.getByCustomer = async (req, res) => {
    try {
        const devices = await CustomerDevice.find({ owner: req.params.customerId })
            .populate('brandId', 'name')
            .populate('modelId', 'name')
            .populate('itemId', 'itemName')
            .populate('variantId', 'variantName')
            .sort({ createdAt: -1 });

        res.json(devices);
    } catch (error) {
        console.error("Error fetching customer devices:", error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Update device status
 */
exports.updateStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const device = await CustomerDevice.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );

        if (!device) {
            return res.status(404).json({ message: "Device not found" });
        }

        res.json(device);
    } catch (error) {
        console.error("Error updating device status:", error);
        res.status(500).json({ message: error.message });
    }
};
