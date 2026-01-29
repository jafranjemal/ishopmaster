const mongoose = require('mongoose');

const purchaseReturnItemSchema = new mongoose.Schema({
    item: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Item',
        required: true
    },
    variant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Variant'
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    unit_price: {
        type: Number,
        required: true
    },
    total_price: {
        type: Number,
        required: true
    },
    serial_numbers: [{
        type: String
    }],
    // Track original purchase item for reference
    original_purchase_item_id: mongoose.Schema.Types.ObjectId
});

const purchaseReturnSchema = new mongoose.Schema({
    return_id: {
        type: String,
        required: true,
        unique: true
    },
    purchase: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Purchase',
        required: true
    },
    supplier: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier',
        required: true
    },
    agent_id: { type: mongoose.Schema.Types.ObjectId }, // Link to Supplier.contacts._id
    return_date: {
        type: Date,
        default: Date.now
    },
    items: [purchaseReturnItemSchema],
    total_amount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected', 'Completed'],
        default: 'Pending'
    },
    reason: {
        type: String,
        required: true
    },
    notes: String,
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    approved_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approved_date: Date,
    // Payment reversal tracking
    payment_reversed: {
        type: Boolean,
        default: false
    },
    reversed_amount: {
        type: Number,
        default: 0
    },
    // Stock reversal tracking
    stock_reversed: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Auto-generate return_id
purchaseReturnSchema.pre('save', async function (next) {
    if (!this.return_id) {
        const count = await mongoose.model('PurchaseReturn').countDocuments();
        this.return_id = `PR-${String(count + 1).padStart(6, '0')}`;
    }
    next();
});

const PurchaseReturn = mongoose.model('PurchaseReturn', purchaseReturnSchema);

module.exports = PurchaseReturn;
