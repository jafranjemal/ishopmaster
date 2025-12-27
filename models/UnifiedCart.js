const mongoose = require('mongoose');

const UnifiedCartSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    shiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift' },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },

    customer: {
        customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
        deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device' }
    },

    items: [{
        type: { type: String, enum: ['product', 'service'] },
        itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
        serviceItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceItem' },
        modelVariantId: String,
        quantity: Number,
        unitPrice: Number,

        // For products
        selectedSerial: String,
        selectedBatch: String,
        costPrice: Number,

        // For services
        partSelections: [{
            requiredPart: String,
            selectedItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
            selectedBatch: String,
            quantity: Number,
            costPrice: Number,
            reserved: { type: Boolean, default: false }
        }],

        serviceConfig: {
            deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device' },
            technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employees' },
            estimatedCompletion: Date,
            warrantyMonths: Number
        }
    }],

    pricing: {
        subtotal: Number,
        discounts: [{
            type: String,
            amount: Number,
            description: String
        }],
        tax: Number,
        total: Number,
        depositRequired: Number,
        balanceDue: Number
    },

    status: {
        type: String,
        enum: ['active', 'converted', 'abandoned'],
        default: 'active'
    },

    createdAt: { type: Date, default: Date.now, expires: 86400 } // 24 hours TTL
});

module.exports = mongoose.model('UnifiedCart', UnifiedCartSchema);
