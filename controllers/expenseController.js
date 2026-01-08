const Expense = require('../models/Expense');

// Generate unique expense ID
const generateExpenseId = async (companyId) => {
    const lastExpense = await Expense.findOne({ Company: companyId })
        .sort({ expense_id: -1 })
        .select('expense_id');

    if (!lastExpense) return 'EXP-000001';

    const lastId = parseInt(lastExpense.expense_id.split('-')[1]);
    const newId = (lastId + 1).toString().padStart(6, '0');
    return `EXP-${newId}`;
};

// Create expense
exports.createExpense = async (req, res) => {
    try {
        const { category, amount, date, description, payment_method, reference_number } = req.body;
        // In this version, we'll allow creating expenses without a company if the user doesn't have one assigned yet
        // This prevents blocking POS flows.
        const companyId = req.user?.company || req.body.Company || "673f84f938f6b647f3ae3c68"; // Using a default ID for now if none provided

        const expense_id = await generateExpenseId(companyId);

        const expense = new Expense({
            expense_id,
            category,
            amount,
            date: date || Date.now(),
            description,
            payment_method: payment_method || 'Cash',
            reference_number,
            Company: companyId,
            created_by: req.user?._id
        });

        await expense.save();
        res.status(201).json({ message: 'Expense created', expense });
    } catch (error) {
        console.error('Create expense error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get all expenses with pagination and filters
exports.getExpenses = async (req, res) => {
    try {
        const { page = 1, limit = 50, category, startDate, endDate, search } = req.query;
        const companyId = req.user?.company || req.query.Company;

        const query = { Company: companyId };

        if (category) query.category = category;
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }
        if (search) {
            query.$or = [
                { description: { $regex: search, $options: 'i' } },
                { expense_id: { $regex: search, $options: 'i' } },
                { reference_number: { $regex: search, $options: 'i' } }
            ];
        }

        const expenses = await Expense.find(query)
            .sort({ date: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .populate('created_by', 'username');

        const count = await Expense.countDocuments(query);

        res.json({
            expenses,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            total: count
        });
    } catch (error) {
        console.error('Get expenses error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get expense by ID
exports.getExpenseById = async (req, res) => {
    try {
        const expense = await Expense.findById(req.params.id).populate('created_by', 'username');
        if (!expense) {
            return res.status(404).json({ message: 'Expense not found' });
        }
        res.json(expense);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Update expense
exports.updateExpense = async (req, res) => {
    try {
        const { category, amount, date, description, payment_method, reference_number } = req.body;

        const expense = await Expense.findByIdAndUpdate(
            req.params.id,
            { category, amount, date, description, payment_method, reference_number },
            { new: true, runValidators: true }
        );

        if (!expense) {
            return res.status(404).json({ message: 'Expense not found' });
        }

        res.json({ message: 'Expense updated', expense });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Delete expense
exports.deleteExpense = async (req, res) => {
    try {
        const expense = await Expense.findByIdAndDelete(req.params.id);
        if (!expense) {
            return res.status(404).json({ message: 'Expense not found' });
        }
        res.json({ message: 'Expense deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get category summary
exports.getCategorySummary = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const companyId = req.user?.company || req.query.Company;

        const matchStage = { Company: companyId };
        if (startDate || endDate) {
            matchStage.date = {};
            if (startDate) matchStage.date.$gte = new Date(startDate);
            if (endDate) matchStage.date.$lte = new Date(endDate);
        }

        const summary = await Expense.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$category',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { total: -1 } }
        ]);

        const totalExpenses = summary.reduce((sum, cat) => sum + cat.total, 0);

        res.json({
            summary: summary.map(cat => ({
                category: cat._id,
                total: cat.total,
                count: cat.count,
                percentage: ((cat.total / totalExpenses) * 100).toFixed(2)
            })),
            totalExpenses
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
