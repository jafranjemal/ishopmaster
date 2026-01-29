const WarrantyAuditLog = require("../models/WarrantyAuditLog");

exports.logCheck = async (req, res) => {
    try {
        const log = new WarrantyAuditLog({
            ...req.body,
            performed_by: req.user?._id
        });
        await log.save();
        res.status(201).json(log);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.getDeviceHistory = async (req, res) => {
    try {
        const { imei } = req.params;
        const logs = await WarrantyAuditLog.find({ imei })
            .populate("performed_by", "name")
            .sort({ createdAt: -1 });
        res.status(200).json(logs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
