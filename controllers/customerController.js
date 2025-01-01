const Customer = require("../models/Customer");
const Account = require("../models/Account");

// Create a new customer and associated account
exports.createCustomer = async (req, res) => {
  try {
    const { first_name, last_name, email, phone_number, address, customer_type, company_name, customer_image, company_tax_id } = req.body;

    // Create the new customer
    const newCustomer = new Customer({
      first_name,
      last_name,
      email,
      phone_number,
      address,
      customer_type,
      company_name,
      customer_image,
      company_tax_id,
    });

    await newCustomer.save();

    // Automatically create a customer's account
    const account_name = `${first_name} ${last_name}'s Account`; // Custom account name
    const account_type = "Customer"; 
    const balance = 0; // Default balance
    const account_owner_type = "Customer";
    const related_party_id = newCustomer._id;

    const newAccount = new Account({
      account_name,
      account_type,
      balance,
      account_owner_type,
      related_party_id,
      description: `Created a new customer account for ${first_name} ${last_name}. This account is classified as a Customer type, registered under ID ${related_party_id}. The initial balance is set to ${balance} to track all transactions and dues effectively.`,
    });

    await newAccount.save();

    res.status(201).json({
      message: "Customer and associated account created successfully!",
      customer: newCustomer,
      account: newAccount,
    });
  } catch (error) {
    console.error("Error creating customer and account:", error);
    res.status(500).json({ message: "Internal server error", error });
  }
};

// Get all customers
exports.getAllCustomers = async (req, res) => {
  try {
    const customers = await Customer.find();
    res.status(200).json(customers);
  } catch (error) {
    console.error("Error fetching customers:", error);
    res.status(500).json({ message: "Internal server error", error });
  }
};

// Get a customer by ID
exports.getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findById(id);

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    // Fetch the customer's account(s)
    const accounts = await Account.find({
      account_owner_type: "Customer",
      related_party_id: id,
    });

    res.status(200).json({ customer, accounts });
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ message: "Internal server error", error });
  }
};

// Update a customer
exports.updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const updatedCustomer = await Customer.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!updatedCustomer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    res.status(200).json({
      message: "Customer updated successfully!",
      customer: updatedCustomer,
    });
  } catch (error) {
    console.error("Error updating customer:", error);
    res.status(500).json({ message: "Internal server error", error });
  }
};

// Delete a customer
exports.deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findByIdAndDelete(id);

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    // Delete associated accounts
    await Account.deleteMany({
      account_owner_type: "Customer",
      related_party_id: id,
    });

    res.status(200).json({ message: "Customer and associated accounts deleted successfully!" });
  } catch (error) {
    console.error("Error deleting customer:", error);
    res.status(500).json({ message: "Internal server error", error });
  }
};
