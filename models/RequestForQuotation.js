const mongoose = require('mongoose');

const RequestForQuotationSchema = new mongoose.Schema({
    rfqNumber: {
        type: String,
        unique: true,
        required: true
    },
    supplier: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier',
        default: null
    },
    supplierName: { // Snapshot for quick display
        type: String,
        default: ''
    },
    agent: { // Specific contact person at the supplier
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    agentName: {
        type: String,
        default: ''
    },
    // Flexible Item Structure (Loose Validation)
    items: [{
        item_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
        variant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ItemVariant', default: null },
        itemName: { type: String, required: true }, // Can be free text for new items
        qty: { type: Number, default: 1 },
        targetPrice: { type: Number, default: 0 },
        notes: { type: String, default: '' }
    }],
    status: {
        type: String,
        enum: ['Draft', 'Sent', 'Converted', 'Closed'],
        default: 'Draft'
    },
    notes: {
        type: String,
        default: ''
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { timestamps: true });

// Pre-validate hook to generate RFQ Number if missing
RequestForQuotationSchema.pre('validate', async function (next) {
    if (!this.rfqNumber) {
        const count = await this.constructor.countDocuments();
        this.rfqNumber = `RFQ-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, '0')}`;
    }
    next();
});

module.exports = mongoose.model('RequestForQuotation', RequestForQuotationSchema);
