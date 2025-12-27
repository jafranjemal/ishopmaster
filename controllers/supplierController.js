// controllers/supplierController.js
const Account = require("../models/Account");
const Supplier = require("../models/Supplier"); // Assuming you have a Supplier model
const Transaction = require("../models/Transaction");

// Get all suppliers with account data
exports.getSuppliers = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = search ? 1 : Math.max(1, parseInt(req.query.page) || 1); // Reset to page 1 on search
    const limit = Math.max(1, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;
    const sortBy = req.query.sortBy || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    // Build Match Stage
    const matchStage = {};
    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = { $regex: safeSearch, $options: "i" };
      matchStage.$or = [
        { business_name: searchRegex },
        { contact_person: searchRegex },
        { supplier_id: searchRegex },
        { "contact_info.contact_number": searchRegex }
      ];
    }

    // Define the Aggregation Pipeline
    const pipeline = [
      { $match: matchStage },
      { $sort: { [sortBy]: sortOrder } },
      {
        $lookup: {
          from: "accounts",
          let: { suppId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$related_party_id", "$$suppId"] },
                    { $eq: ["$account_owner_type", "Supplier"] }
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

    // Execute aggregation
    const result = await Supplier.aggregate(pipeline).allowDiskUse(true);

    const facetResult = result[0] || { metadata: [], data: [] };
    const total = facetResult.metadata[0]?.total || 0;
    const data = facetResult.data || [];

    res.status(200).json({
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error("Supplier aggregation error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
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
      balance: balance * -1,
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
// Search suppliers (for simple dropdowns/typeahead)
exports.searchSuppliers = async (req, res) => {
  try {
    const search = req.query.query || req.query.search || "";
    const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = { $regex: safeSearch, $options: "i" };

    const query = search ? {
      $or: [
        { business_name: searchRegex },
        { contact_person: searchRegex },
        { supplier_id: searchRegex }
      ]
    } : {};

    const suppliers = await Supplier.find(query)
      .limit(50)
      .sort({ business_name: 1 })
      .select('business_name contact_person supplier_id _id');

    res.status(200).json(suppliers);
  } catch (error) {
    res.status(500).json({ message: "Search failed", error: error.message });
  }
};
