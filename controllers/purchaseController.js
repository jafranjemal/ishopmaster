const Purchase = require("../models/Purchase");
const Stock = require("../models/Stock");
const Account = require("../models/Account");
const Transaction = require("../models/Transaction");
const mongoose = require("mongoose");

// Create a new purchase
exports.createPurchase_old = async (req, res) => {
  try {
    const purchaseData = req.body;

    // Generate unique batch number for each purchased item
    purchaseData.purchasedItems = purchaseData.purchasedItems.map((item) => ({
      ...item,
      batch_number: `BATCH-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    }));

    // Save the purchase
    const purchase = new Purchase(purchaseData);
    await purchase.save();

    // Update Stock
for (const item of purchase.purchasedItems) {
    // Find all existing stock entries for this item_id
    const existingStockEntries = await Stock.find({ item_id: item.item_id });
  
    // Sum up the available quantities to get the total stock before this purchase
    const beforePurchaseAvailable_qty = existingStockEntries.reduce(
      (sum, stock) => sum + stock.available_qty,
      0
    );
  
    // Create a new stock entry for the new batch
    await Stock.create({
      item_id: item.item_id,
      purchase_id: purchase._id,
      batch_number: item.batch_number,
      purchase_date: purchase.purchaseDate,
      purchase_qty: item.purchaseQty,
      available_qty: item.purchaseQty, // New batch's available quantity starts as the purchase quantity
      beforePurchaseAvailable_qty: beforePurchaseAvailable_qty, // Total available stock before this purchase
      unit_cost: item.unitCost,
      selling_price: item.sellingPrice,
      unit: item.unit,
    });
  }



    res.status(201).json({ message: "Purchase created successfully", purchase });
  } catch (error) {
    res.status(500).json({ message: "Error creating purchase", error });
  }
};




// Create a new purchase
exports.createPurchase = async (req, res) => {
  //const session = await mongoose.startSession();
 // session.startTransaction();

  try {
    const purchaseData = req.body;

    // Generate unique batch number for each purchased item
    purchaseData.purchasedItems = purchaseData.purchasedItems.map((item) => ({
      ...item,
      batch_number: `BATCH-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()}`,
    }));

    // Save the purchase
    const purchase = new Purchase(purchaseData);
    await purchase.save();

    // Update Stock
    for (const item of purchase.purchasedItems) {
      // Find all existing stock entries for this item_id
      const existingStockEntries = await Stock.find({ item_id: item.item_id });

      // Sum up the available quantities to get the total stock before this purchase
      const beforePurchaseAvailable_qty = existingStockEntries.reduce(
        (sum, stock) => sum + stock.available_qty,
        0
      );

      // Create a new stock entry for the new batch
      await Stock.create(
        {
          item_id: item.item_id,
          purchase_id: purchase._id,
          batch_number: item.batch_number,
          purchase_date: purchase.purchaseDate,
          purchase_qty: item.purchaseQty,
          available_qty: item.purchaseQty,
          beforePurchaseAvailable_qty: beforePurchaseAvailable_qty,
          unit_cost: item.unitCost,
          selling_price: item.sellingPrice,
          unit: item.unit,
        },
        //{ session }
      );
    }

    // Find the supplier account
    const supplierAccount = await Account.findOne({
      account_owner_type: "Supplier",
      related_party_id: purchase.supplier,
    });

    if (!supplierAccount) {
      throw new Error("Supplier account not found.");
    }

    // Deduct the grand total from the supplier's account balance
    supplierAccount.balance -= purchase.grand_total;
    await supplierAccount.save();

    // Record the transaction
    const transaction = new Transaction({
      account_id: supplierAccount._id,
      amount: purchase.grand_total,
      transaction_type: "Withdrawal",
      reason: `Purchase: ${purchase.referenceNumber}`,
      transaction_date: new Date(),
      balance_after_transaction: supplierAccount.balance,
    });

    await transaction.save();

    //await session.commitTransaction();
    //session.endSession();

    res.status(201).json({ message: "Purchase created successfully", purchase });
  } catch (error) {
    //await session.abortTransaction();
    //session.endSession();
    console.error("Error creating purchase:", error);
    res.status(500).json({ message: "Error creating purchase", error });
  }
};


// Get all purchases
exports.getAllPurchases = async (req, res) => {
  try {
    const purchases = await Purchase.find().populate("supplier").populate("purchasedItems.item_id");
    res.status(200).json(purchases);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving purchases", error });
  }
};

// Get a single purchase by ID
exports.getPurchaseById = async (req, res) => {
  try {
    const { id } = req.params;
    const purchase = await Purchase.findById(id).populate("supplier").populate("purchasedItems.item_id");
    if (!purchase) {
      return res.status(404).json({ message: "Purchase not found" });
    }
    res.status(200).json(purchase);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving purchase", error });
  }
};

// Update a purchase
exports.updatePurchase = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedData = req.body;

    const purchase = await Purchase.findByIdAndUpdate(id, updatedData, { new: true });

    if (!purchase) {
      return res.status(404).json({ message: "Purchase not found" });
    }

    // Update Stock
    for (const item of updatedData.purchasedItems) {
      const stockEntry = await Stock.findOne({ item_id: item.item_id, batch_number: item.batch_number });

      if (stockEntry) {
        // Adjust stock quantities
        stockEntry.available_qty += item.purchase_qty;
        await stockEntry.save();
      } else {
        // Add new stock entry
        await Stock.create({
          item_id: item.item_id,
          batch_number: item.batch_number,
          purchase_date: purchase.purchase_date,
          purchase_qty: item.purchase_qty,
          available_qty: item.purchase_qty,
          unit_cost: item.unit_cost,
          selling_price: item.selling_price,
        });
      }
    }

    res.status(200).json({ message: "Purchase updated successfully", purchase });
  } catch (error) {
    res.status(500).json({ message: "Error updating purchase", error });
  }
};

// Delete a purchase
exports.deletePurchase = async (req, res) => {
  try {
    const { id } = req.params;
    const purchase = await Purchase.findByIdAndDelete(id);

    if (!purchase) {
      return res.status(404).json({ message: "Purchase not found" });
    }

    // Revert stock changes
    for (const item of purchase.purchasedItems) {
      const stockEntry = await Stock.findOne({ item_id: item.item_id, batch_number: item.batch_number });

      if (stockEntry) {
        stockEntry.available_qty -= item.purchase_qty;
        if (stockEntry.available_qty <= 0) {
          await stockEntry.remove(); // Remove stock entry if quantity becomes zero
        } else {
          await stockEntry.save();
        }
      }
    }

    res.status(200).json({ message: "Purchase deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting purchase", error });
  }
};
