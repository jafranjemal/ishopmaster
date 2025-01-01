// controllers/supplierController.js
const Account = require("../models/Account");
const Supplier = require("../models/Supplier"); // Assuming you have a Supplier model
const Transaction = require("../models/Transaction");

// Get all suppliers
exports.getSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.find();
    res.status(200).json(suppliers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get supplier by ID
exports.getSupplierById = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }
    res.status(200).json(supplier);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Add a new supplier
exports.addSupplier = async (req, res) => {
  const { business_name, contact_person, address, contact_info, financial, bank_details, logo_image, notes } = req.body;
  if (req.body._id) {
    delete req.body._id;
  }
  try {
    const newSupplier = new Supplier(req.body);
    await newSupplier.save();

    // Automatically create a supplier's account
    const account_name = `${business_name}'s Payable Account (${newSupplier.supplier_id})`; // Custom account name for better clarity 
    const account_type = "Payable"; 
    const balance = financial.opening_balance || 0; // Default balance 
    const account_owner_type = "Supplier"; 
    const related_party_id = newSupplier._id; 
    
    const newAccount = new Account({ 
        account_name, 
        account_type, 
        balance, 
        account_owner_type, 
        related_party_id, 
        description: `Initialized ${account_name} with a ${account_type} account type for ${business_name}. The opening balance is set to ${balance}. This account will manage all transactions and dues related to the supplier, identified by ID: ${related_party_id}.`, 
    }); 
    await newAccount.save();

 
    // Save to transactionSchema if balance is more than zero
if (balance > 0) {
    const newTransaction = new Transaction({
      account_id: newAccount._id,
      amount: balance * -1,
      transaction_type: 'Withdrawal', // Recording as Withdrawal since it's due
      reason: 'Opening Balance Due',
      balance_after_transaction: balance * -1, // Reflects a negative balance due
      transaction_date: new Date(),
    });
  
    await newTransaction.save();
  }
  
    
    
    
    res.status(201).json(newSupplier);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: "Error adding supplier" });
  }
};

// Update supplier
exports.updateSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }
    
    res.status(200).json(supplier);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: "Error updating supplier" });
  }
};

// Delete supplier
exports.deleteSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndDelete(req.params.id);
    
    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }
    
    res.status(200).json({ message: "Supplier deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: "Error deleting supplier" });
  }
};
