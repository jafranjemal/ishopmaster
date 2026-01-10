// controllers/companyController.js

const Company = require("../models/Company"); // Import the Company model
const Transaction = require("../models/Transaction");
const Account = require("../models/Account");
const { ApiError } = require("../utility/ApiError");

// Create a new company
exports.createCompany = async (req, res, next) => {
  try {
    const existingCompany = await Company.countDocuments();

    if (existingCompany > 0) {
      throw new ApiError(400, 'Only one company is allowed in the system');
    }


    const { company_name, company_type, contact_person, email, phone_number, address, tax_id, registration_number } = req.body;

    const newCompany = new Company({
      company_name,
      company_type,
      contact_person,
      email,
      phone_number,
      address,
      tax_id,
      registration_number,
    });

    await newCompany.save();
    res.status(201).json({
      message: "Company created successfully",
      company: newCompany,
    });
  } catch (error) {
    res.status(500).json({ message: "Error creating company", error });
    next(error)
  }
};

// Get all companies
exports.getAllCompanies = async (req, res) => {
  try {
    const companies = await Company.find();
    res.status(200).json(companies);
  } catch (error) {
    res.status(500).json({ message: "Error fetching companies", error });
  }
};

// Get a company by ID
exports.getCompanyById = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }
    res.status(200).json(company);
  } catch (error) {
    res.status(500).json({ message: "Error fetching company", error });
  }
};

// Update company details
exports.updateCompany = async (req, res) => {
  try {
    const updates = req.body;
    const company = await Company.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }
    res.status(200).json({ message: "Company updated successfully", company });
  } catch (error) {
    res.status(500).json({ message: "Error updating company", error });
  }
};

// Delete a company
exports.deleteCompany = async (req, res) => {
  try {
    const company = await Company.findByIdAndDelete(req.params.id);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }
    res.status(200).json({ message: "Company deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting company", error });
  }
};


exports.getCompanyProfile_old = async (req, res) => {
  try {
    const { companyId } = req.params;

    // Fetch the company profile
    const company = await Company.findById(companyId);

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // Initialize account data
    let account = null;
    let transactions = [];
    let totalRevenueAmount = 0;
    let totalExpensesAmount = 0;

    // Fetch related account details only if it exists
    const checkExistAccount = await Account.findOne({
      account_owner_type: "Company",
      related_party_id: companyId,
    });

    if (checkExistAccount) {
      account = await Account.findOne({
        account_owner_type: "Company",
        related_party_id: companyId,
      });

      if (account) {
        // Fetch transactions linked to the company's account
        transactions = await Transaction.find({ account_id: account._id })
          .sort({ transaction_date: -1 }); // Most recent transactions first

        // Calculate total revenue (deposits)
        const totalRevenue = await Transaction.aggregate([
          { $match: { account_id: account._id, transaction_type: "Deposit" } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]);

        // Calculate total expenses (withdrawals)
        const totalExpenses = await Transaction.aggregate([
          { $match: { account_id: account._id, transaction_type: "Withdrawal" } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]);

        totalRevenueAmount = totalRevenue[0]?.total || 0;
        totalExpensesAmount = totalExpenses[0]?.total || 0;
      }
    }

    // Construct the response data
    const profileData = {
      ...company.toObject(),

      account_balance: account ? account.balance : null, // Null if no account
      total_revenue: totalRevenueAmount,
      total_expenses: totalExpensesAmount,
      net_balance: totalRevenueAmount - totalExpensesAmount,
      transactions: transactions.slice(0, 3).map((txn) => ({
        date: txn.transaction_date,
        description: txn.reason,
        type: txn.transaction_type,
        amount: txn.amount,
        status: txn.transaction_status || "Completed", // Assuming txn.transaction_status exists
      })),
    };

    return res.status(200).json(profileData);
  } catch (error) {
    console.error("Error fetching company profile:", error);
    return res.status(500).json({ message: "Internal server error", error });
  }
};

exports.getCompanyProfile = async (req, res) => {
  try {
    const { companyId } = req.params;

    // Fetch the company profile
    const company = await Company.findById(companyId);

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // Initialize account data
    let accounts = [];
    let transactions = [];
    let totalRevenueAmount = 0;
    let totalExpensesAmount = 0;

    // Fetch all accounts related to the company
    accounts = await Account.find({
      account_owner_type: "Company",
      related_party_id: companyId,
    });

    if (accounts.length > 0) {
      // Fetch transactions linked to the company's accounts
      transactions = await Transaction.find({
        account_id: { $in: accounts.map(account => account._id) },
      }).sort({ transaction_date: -1 }); // Most recent transactions first

      // Calculate total revenue (Deposit or Investment)
      const totalRevenue = await Transaction.aggregate([
        {
          $match: {
            account_id: { $in: accounts.map(account => account._id) },
            $or: [
              { transaction_type: "Deposit" },
              { transaction_type: "Investment" },
            ],
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
          },
        },
      ]);

      // Calculate total expenses (Withdrawals)
      const totalExpenses = await Transaction.aggregate([
        {
          $match: {
            account_id: { $in: accounts.map(account => account._id) },
            transaction_type: "Withdrawal",
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
          },
        },
      ]);

      totalRevenueAmount = totalRevenue[0]?.total || 0;
      totalExpensesAmount = totalExpenses[0]?.total || 0;
    }

    // Construct the response data
    const profileData = {
      ...company.toObject(),
      accountsCount: accounts.length,
      account_balance: accounts.reduce((total, account) => total + account.balance, 0),
      total_revenue: totalRevenueAmount,
      total_expenses: totalExpensesAmount,
      net_balance: totalRevenueAmount - totalExpensesAmount,
      transactions: transactions.slice(0, 5).map((txn) => ({
        date: txn.transaction_date,
        description: txn.reason,
        type: txn.transaction_type,
        amount: txn.amount,
        status: txn.transaction_status || "Completed",
      })),
    };

    return res.status(200).json(profileData);
  } catch (error) {
    console.error("Error fetching company profile:", error);
    return res.status(500).json({ message: "Internal server error", error });
  }
};
