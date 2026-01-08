const mongoose = require('mongoose');

const ExpenseSchema = new mongoose.Schema({
    expense_id: {
        type: String,
        required: true,
        unique: true
    },
    category: {
        type: String,
        required: true,
        enum: [
            'Rent',
            'Salaries',
            'Utilities',
            'Marketing',
            'Maintenance',
            'Supplies',
            'Insurance',
            'Transportation',
            'Professional Fees',
            'Taxes',
            'Other'
        ]
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    description: {
        type: String,
        trim: true
    },
    payment_method: {
        type: String,
        enum: ['Cash', 'Bank Transfer', 'Credit Card', 'Cheque', 'Other'],
        default: 'Cash'
    },
    reference_number: {
        type: String,
        trim: true
    },
    Company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Index for faster queries
ExpenseSchema.index({ Company: 1, date: -1 });
ExpenseSchema.index({ category: 1 });
ExpenseSchema.index({ expense_id: 1 });

module.exports = mongoose.model('Expense', ExpenseSchema);
