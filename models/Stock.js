const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
    item_id: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    purchase_id: { type: mongoose.Schema.Types.ObjectId, ref: "Purchase", required: true },
    batch_number: { type: String, required: true },
    purchase_date: { type: Date, required: true },
    purchase_qty: { type: Number, required: true },
    available_qty: { type: Number, required: true }, // Remaining stock
    beforePurchaseAvailable_qty: { type: Number, required: true }, // Before purchase stock
    sold_qty: { type: Number, default: 0 }, // Sold quantity
    adjustment_qty: { type: Number, default: 0 }, // Adjustments (returns, damages)
    unit_cost: { type: Number, required: true },
    unit: { type: String, required: true },
    selling_price: { type: Number, required: true },
    profit_margin: { 
        type: Number, 
        required: false, 
        default: function() {
            return ((this.selling_price - this.unit_cost) / this.unit_cost) * 100;
        } 
    }, // Profit margin calculated dynamically
    expiry_date: { type: Date }, // Optional: Expiry date for perishable goods
    adjustment_reason: { type: String }, // Reason for stock adjustment (if any)
});

module.exports = mongoose.model("Stock", stockSchema);
