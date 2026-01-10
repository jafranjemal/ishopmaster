const Customer = require("../models/Customer");
const Account = require("../models/Account");
const mongoose = require("mongoose");

// Create a new customer and associated account
exports.createCustomer = async (req, res) => {
  try {
    const { first_name, last_name, email, phone_number, address, customer_type, company_name, customer_image, company_tax_id, nic_number, id_front_image, id_back_image } = req.body;

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
      nic_number,
      id_front_image,
      id_back_image,
    });

    await newCustomer.save();

    // Automatically create a customer's account
    const account_name = `${first_name}'s Account (${newCustomer.customer_id})`;
    const account_type = "Customer";
    const balance = 0;
    const account_owner_type = "Customer";
    const related_party_id = newCustomer._id;

    const newAccount = new Account({
      account_name,
      account_type,
      balance,
      account_owner_type,
      related_party_id,
      description: `Default account for ${first_name} ${last_name}.`,
    });

    await newAccount.save();

    res.status(201).json({
      message: "Customer created successfully",
      customer: newCustomer,
    });
  } catch (error) {
    console.error("Error creating customer:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

// Get all customers (legacy support)
exports.getAllCustomers = async (req, res) => {
  try {
    const customers = await Customer.find().sort({ created_at: -1 });
    res.status(200).json(customers);
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Retrieves paginated customers with their associated accounts.
 */

exports.getCustomersAndAccounts = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;
    const sortBy = req.query.sortBy || "created_at";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    // 1. Build Match Stage with Sanitized Regex
    const matchStage = {};
    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Sanitize regex
      const searchRegex = { $regex: safeSearch, $options: "i" };
      matchStage.$or = [
        { first_name: searchRegex },
        { last_name: searchRegex },
        { customer_id: searchRegex },
        { phone_number: searchRegex },
        { company_name: searchRegex }
      ];
    }

    // 2. Define the Pipeline
    const pipeline = [
      { $match: matchStage },
      // Sort before facet for pagination accuracy
      { $sort: { [sortBy]: sortOrder } },
      {
        $lookup: {
          from: "accounts", // Must be the actual collection name in MongoDB
          let: { custId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$related_party_id", "$$custId"] },
                    { $eq: ["$account_owner_type", "Customer"] }
                  ]
                }
              }
            },
            { $limit: 1 }
          ],
          as: "account"
        }
      },
      {
        $addFields: {
          account: { $arrayElemAt: ["$account", 0] }
        }
      },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [{ $skip: skip }, { $limit: limit }]
        }
      }
    ];

    // 3. Execute with allowDiskUse to avoid 500 Memory Limit Errors
    const result = await Customer.aggregate(pipeline).allowDiskUse(true);

    const facetResult = result[0] || { metadata: [], data: [] };
    const total = facetResult.metadata[0]?.total || 0;
    const data = facetResult.data || [];

    return res.status(200).json({
      success: true,
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });

  } catch (error) {
    console.error("Aggregation Error Details:", error);
    return res.status(500).json({
      success: false,
      message: "An internal error occurred during data retrieval.",
      error: error.message // Hide stack in production for security
    });
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

    const account = await Account.findOne({
      account_owner_type: "Customer",
      related_party_id: id,
    });

    res.status(200).json({ customer, account });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update a customer
exports.updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedCustomer = await Customer.findByIdAndUpdate(id, req.body, { new: true });

    if (!updatedCustomer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    res.status(200).json({
      message: "Customer updated successfully",
      customer: updatedCustomer,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
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

    await Account.deleteMany({
      account_owner_type: "Customer",
      related_party_id: id,
    });

    res.status(200).json({ message: "Customer deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};
