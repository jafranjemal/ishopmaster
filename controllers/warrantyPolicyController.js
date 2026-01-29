const WarrantyPolicy = require("../models/WarrantyPolicy");

exports.getPolicies = async (req, res) => {
    try {
        const policies = await WarrantyPolicy.find({ is_deleted: false });
        res.status(200).json(policies);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createPolicy = async (req, res) => {
    try {
        const policy = new WarrantyPolicy(req.body);
        await policy.save();
        res.status(201).json(policy);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updatePolicy = async (req, res) => {
    try {
        const policy = await WarrantyPolicy.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!policy) return res.status(404).json({ message: "Policy not found" });
        res.status(200).json(policy);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deletePolicy = async (req, res) => {
    try {
        // Soft delete
        const policy = await WarrantyPolicy.findByIdAndUpdate(req.params.id, { is_deleted: true }, { new: true });
        if (!policy) return res.status(404).json({ message: "Policy not found" });
        res.status(200).json({ message: "Policy deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
