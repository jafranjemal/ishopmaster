// models/Shift.js
const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'users', // Reference to the User schema
            required: true
        },
        startCash: {
            type: Number,
            required: true
        },
        cashAdded: {
            type: Number,
            default: 0
        },
        cashRemoved: {
            type: Number,
            default: 0
        },
        cashRegister: [
            {
                entry_type: {
                    type: String,
                    enum: ['in', 'out'],
                    required: true
                },
                amount: {
                    type: Number,
                    required: true
                },
                reason: {
                    type: String
                },
                createdAt: {
                    type: Date,
                    default: Date.now
                }
            }
        ],
        endCash: {
            type: Number
        },
        actualCash: { type: Number }, // Physical count
        mismatch: { type: Number }, // Difference (Actual - System)
        totalSales: {
            type: Number,
            default: 0
        },
        totalTransactions: {
            type: Number,
            default: 0
        },
        startTime: {
            type: Date,
            default: Date.now
        },
        endTime: {
            type: Date
        },
        notes: {
            type: String
        },
        isClosed: {
            type: Boolean,
            default: false
        },
        sales: [],
        status: {
            type: String,
            enum: ['active', 'closed', 'canceled'],
            default: 'active'
        },
        paymentBreakdown: [
            {
                method: { type: String, enum: ["Account", "Cash", "Card", "Cheque", "Bank Transfer"], required: true },
                expected: { type: Number, default: 0 },
                actual: { type: Number, default: 0 },
                mismatch: { type: Number, default: 0 }
            }
        ],
        totalCashSales: {
            type: Number,
            default: 0
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    });

shiftSchema.virtual('calculatedEndCash').get(function () {
    return (this.totalCashSales || 0) + this.startCash + this.cashAdded - this.cashRemoved;
});


/**
 * Closes the shift by updating its status and calculating the end cash.
 */
shiftSchema.methods.closeShift = async function () {
    try {
        // Update shift status and end time
        this.endTime = new Date();
        this.isClosed = true;
        this.status = 'closed';

        // Calculate end cash
        this.endCash = this.calculateEndCash();

        // Save the updated shift
        await this.save();
    } catch (error) {
        // Handle any errors that occur during the process
        console.error('Error closing shift:', error);
    }
};

/**
 * Calculates the end cash by adding the cash added and subtracting the cash removed from the start cash.
 * @returns {number} The calculated end cash.
 */
shiftSchema.methods.calculateEndCash = function () {
    return (this.totalCashSales || 0) + this.startCash + this.cashAdded - this.cashRemoved;
};

const Shift = mongoose.model('Shift', shiftSchema);
module.exports = Shift;