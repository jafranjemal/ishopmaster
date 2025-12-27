const Account = require("../models/Account");
const Transaction = require("../models/Transaction");

// Create Account
exports.createAccount = async (req, res) => {
  try {
    //const { account_name, account_type, balance, description } = req.body;
    const { account_name, account_type, balance, account_owner_type, related_party_id, description } = req.body;

    // const newAccount = new Account({ account_name, account_type, balance, description });

    // Create a new account using the data from the request body
    const newAccount = new Account({
      account_name,
      account_type,
      balance: balance || 0,  // Default to 0 if balance is not provided
      account_owner_type: account_owner_type || "Company",  // Default to "Company"
      related_party_id,
      description: description || "",
    });


    await newAccount.save();

    if (Number(balance) > 0) {
      const transaction = new Transaction({
        account_id: newAccount._id,
        amount: balance,
        transaction_type: "Deposit",
        reason: "Initial Balance",
        balance_after_transaction: balance, // Balance after the deposit
      });

      await transaction.save();

    }

    res.status(201).json({ message: "Account created successfully", account: newAccount });
  } catch (error) {
    res.status(500).json({ message: "Error creating account", error });
  }
};

// Get All Accounts
exports.getAllAccounts = async (req, res) => {
  try {
    const accounts = await Account.find();
    res.status(200).json(accounts);
  } catch (error) {
    res.status(500).json({ message: "Error fetching accounts", error });
  }
};

// Get Account by ID
exports.getAccountById = async (req, res) => {
  try {
    const account = await Account.findById(req.params.id);
    if (!account) return res.status(404).json({ message: "Account not found" });
    res.status(200).json(account);
  } catch (error) {
    res.status(500).json({ message: "Error fetching account", error });
  }
};

// Update Account
exports.updateAccount = async (req, res) => {
  try {
    const { account_name, account_type, balance, description } = req.body;
    const account = await Account.findByIdAndUpdate(
      req.params.id,
      { account_name, account_type, balance, description, updated_at: Date.now() },
      { new: true }
    );
    if (!account) return res.status(404).json({ message: "Account not found" });
    res.status(200).json({ message: "Account updated successfully", account });
  } catch (error) {
    res.status(500).json({ message: "Error updating account", error });
  }
};

// Delete Account
exports.deleteAccount = async (req, res) => {
  try {
    const account = await Account.findByIdAndDelete(req.params.id);
    if (!account) return res.status(404).json({ message: "Account not found" });
    res.status(200).json({ message: "Account deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting account", error });
  }
};
// Get Account by Owner Type and Related Party ID
exports.getAccountByOwner = async (req, res) => {
  try {
    const { type, id } = req.params;
    const account = await Account.findOne({
      account_owner_type: type,
      related_party_id: id,
    });
    if (!account) return res.status(404).json({ message: "Account not found" });
    res.status(200).json(account);
  } catch (error) {
    res.status(500).json({ message: "Error fetching account", error });
  }
};
