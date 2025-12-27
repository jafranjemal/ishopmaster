const StockLedger = require("../models/StockLedger");
const Item = require("../models/Items"); // Ensure Item model is registered

exports.getItemHistory = async (req, res) => {
    try {
        const { itemId } = req.params;

        const history = await StockLedger.find({ item_id: itemId })
            .populate({
                path: "purchase_id",
                populate: { path: "supplier" }
            })
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json(history);
    } catch (err) {
        res.status(500).json({ message: "Error fetching stock history", error: err.message });
    }
};

exports.getAllAdjustments = async (req, res) => {
    try {
        const adjustments = await StockLedger.find({
            movementType: { $in: ["Adjustment-In", "Adjustment-Out", "Adjustment_In", "Adjustment_Out"] }
        })
            .populate("item_id", "itemName barcode category units")
            .sort({ createdAt: -1 })
            .limit(200)
            .lean();

        res.status(200).json(adjustments);
    } catch (err) {
        res.status(500).json({ message: "Error fetching adjustments", error: err.message });
    }
};
