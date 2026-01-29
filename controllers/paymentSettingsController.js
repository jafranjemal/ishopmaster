const PaymentSettings = require("../models/PaymentSettings");
const Account = require("../models/Account");

// Get all payment method mappings
exports.getMappings = async (req, res) => {
    try {
        const mappings = await PaymentSettings.find().populate("account_id");
        res.status(200).json(mappings);
    } catch (error) {
        console.error("Error fetching payment settings:", error);
        res.status(500).json({ message: "Error fetching payment settings", error: error.message });
    }
};

// Create or Update a mapping
exports.updateMapping = async (req, res) => {
    const { method_name, account_id, is_active } = req.body;

    if (!method_name || !account_id) {
        return res.status(400).json({ message: "Method name and Account ID are required." });
    }

    try {
        // Verify account exists and is a Company account (for safety)
        const account = await Account.findById(account_id);
        if (!account) {
            return res.status(404).json({ message: "Target account not found." });
        }

        // We generally map payments to Company Accounts (Asset), but flexibility allows others if needed.
        // Ideally, we warn if it's not a Company account, but we won't block strictly unless requested.
        if (account.account_owner_type !== 'Company') {
            // Just a log for now, or we can enforce strictness.
            // For now, let's allow flexibility as per "Generic GL Mapping" request.
        }

        const mapping = await PaymentSettings.findOneAndUpdate(
            { method_name },
            { account_id, is_active: is_active !== undefined ? is_active : true },
            { new: true, upsert: true }
        ).populate("account_id");

        res.status(200).json({ message: "Mapping saved successfully", mapping });
    } catch (error) {
        console.error("Error updating payment setting:", error);
        res.status(500).json({ message: "Error updating payment setting", error: error.message });
    }
};

// Delete a mapping
exports.deleteMapping = async (req, res) => {
    const { id } = req.params;
    try {
        await PaymentSettings.findByIdAndDelete(id);
        res.status(200).json({ message: "Mapping deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting mapping", error: error.message });
    }
};
