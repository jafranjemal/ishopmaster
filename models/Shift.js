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
        /**
         * accountId: The target Cash Drawer / Workstation box.
         * Example: "Main Register", "Drawer 01"
         */
        accountId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Account',
            // required: true // Removed to support bulk closure of legacy active shifts
        },
        /**
         * sourceAccountId: The 'Vault' or 'Safe' account where the opening float comes from.
         * Used only when starting a session from scratch (not Carry-Forward).
         * Example: "Main Shop Safe", "Back-Office Bank"
         */
        sourceAccountId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Account'
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
                category: {
                    type: String,
                    enum: ['Safe Drop', 'Float Top-up', 'Petty Cash', 'Supplier Payment', 'Refund', 'Misc Income', 'Generic'],
                    default: 'Generic'
                },
                authorizedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'users'
                },
                transactionId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Transaction'
                },
                snapshotBalance: {
                    type: Number // System expected balance at time of entry
                },
                createdAt: {
                    type: Date,
                    default: Date.now
                }
            }
        ],
        openingMismatch: { type: Number, default: 0 }, // Difference found at start
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
            enum: ['active', 'closing', 'closed', 'canceled'],
            default: 'active'
        },
        // Immutable Snapshots (Hard Cutoff)
        finalCalculatedCash: { type: Number },
        finalTotalSales: { type: Number },
        finalPaymentBreakdown: [
            {
                method: { type: String },
                expected: { type: Number },
                actual: { type: Number },
                mismatch: { type: Number }
            }
        ],
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
        totalNonCashSales: {
            type: Number,
            default: 0
        },
        auditMetadata: {
            verifiedIMEIs: [{ type: String }],
            totalIMEIs: { type: Number, default: 0 }
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    });

shiftSchema.virtual('calculatedEndCash').get(function () {
    // We add openingMismatch because if starting cash was actually 4800 (but ledger said 5000), 
    // the system expects 200 less than the simple sum.
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