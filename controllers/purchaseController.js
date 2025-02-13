const Purchase = require("../models/Purchase");
const Stock = require("../models/Stock");
const Account = require("../models/Account");
const Transaction = require("../models/Transaction");
const mongoose = require("mongoose");
const SerializedStock = require("../models/SerializedStock");
const NonSerializedStock = require("../models/NonSerializedStock");

// Create a new purchase
exports.createPurchase_old = async (req, res) => {
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

    res
      .status(201)
      .json({ message: "Purchase created successfully", purchase });
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

    const batchNo = `BATCH-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`;
    // Generate unique batch number for each purchased item

    // console.log(purchaseData.purchasedItems.map(x=> x.serializedItems))
    // return

    purchaseData.purchasedItems = purchaseData.purchasedItems.map((item) => {
      // If the item is serialized, also assign batch number to each serialized item
      if (item.isSerialized && item.serializedItems) {
        item.serializedItems = item.serializedItems.map((itm) => ({
          ...itm,
          batch_number: batchNo,
        }));
      } 

      return {
        ...item,
        batch_number: batchNo,
      };
    });

    

    // Save the purchase
    const purchase = new Purchase(purchaseData);
    await purchase.save();

    // Update Stock
    for (const item of purchase.purchasedItems) {
      // Find all existing stock entries for this item_id
      let existingStockEntries;
      let beforePurchaseAvailable_qty = 0;

      if (item.isSerialized) {
        // If item is serialized, query the SerializedStock collection
        existingStockEntries = await SerializedStock.find({
          item_id: item.item_id,
          status: "Available",
        });

        // Sum up the available quantities to get the total stock before this purchase (only serialized items)
        beforePurchaseAvailable_qty = existingStockEntries.length;
      } else {
        // If item is non-serialized, query the NonSerializedStock collection
        existingStockEntries = await NonSerializedStock.find({
          item_id: item.item_id,
        });

        // Sum up the available quantities to get the total stock before this purchase (only non-serialized items)
        beforePurchaseAvailable_qty = existingStockEntries.reduce(
          (sum, stock) => sum + stock.availableQty,
          0
        );
      }

      if (item.isSerialized) {
        // Handle serialized items
        if (item.serializedItems && item.serializedItems.length > 0) {
          for (const serializedItem of item.serializedItems) {
            // Create a new stock entry for each serialized item
            await SerializedStock.create({
              item_id: item.item_id,
              purchase_id: purchase._id,
              serialNumber: serializedItem.serialNumber, // Assuming serializedItem has a serialNumber field
              batch_number: item.batch_number,
              purchaseDate: purchase.purchaseDate,
              unitCost: serializedItem.unitCost,
              sellingPrice: serializedItem.sellingPrice,
              status: "Available", // Set status based on the initial state of the serialized item
            }); 
          }
        }
      } else {
        // Handle non-serialized items
        await NonSerializedStock.create({
          item_id: item.item_id,
          purchase_id: purchase._id,
          batch_number: item.batch_number,
          purchaseDate: purchase.purchaseDate,
          purchaseQty: item.purchaseQty,
          availableQty: item.purchaseQty,
          beforePurchaseAvailableQty: beforePurchaseAvailable_qty,
          unitCost: item.unitCost,
          sellingPrice: item.sellingPrice,
          unit: item.unit,
        });
      }
    }
    //end of stock update

    // Find the supplier account
    const supplierAccount = await Account.findOne({
      account_owner_type: "Supplier",
      related_party_id: purchase.supplier,
    });

    if (!supplierAccount) {
      throw new Error("Supplier account not found.");
    }

    
    // Calculate the new due amount by adding the current grand total to the existing balance
    const newDueAmount = supplierAccount.balance - purchase.grand_total; // Subtract purchase grand total from existing balance

    // Update the supplier account balance with the new due amount
    supplierAccount.balance = newDueAmount;

    await supplierAccount.save();

    // Record the transaction
    const transaction = new Transaction({
      account_id: supplierAccount._id,
      amount: purchase.grand_total *-1,
      transaction_type: "Withdrawal",
      reason: `Purchase: ${purchase.referenceNumber}`,
      transaction_date: new Date(),
      balance_after_transaction: supplierAccount.balance,
    });

    await transaction.save();

    //await session.commitTransaction();
    //session.endSession();

    res
      .status(201)
      .json({ message: "Purchase created successfully", purchase });
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
    const purchases = await Purchase.find()
      .populate("supplier")
      .populate("purchasedItems.item_id");
    res.status(200).json(purchases);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving purchases", error });
  }
};

// Get a single purchase by ID
exports.getPurchaseById = async (req, res) => {
  try {
    const { id } = req.params;
    const purchase = await Purchase.findById(id)
      .populate("supplier")
      .populate("purchasedItems.item_id");
    if (!purchase) {
      return res.status(404).json({ message: "Purchase not found" });
    }
    res.status(200).json(purchase);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving purchase", error });
  }
};

exports.getDuePurchaseBySupplierId = async (req, res) => {
  try {
    const { id } = req.params;
const purchases = await Purchase.find({ 'supplier': id, 'payment_due_amount': { $gt: 0 } })
.populate("supplier")
.populate("purchasedItems.item_id").sort({
  _id:-1
})
    if (purchases.length === 0) {
      return res.status(404).json({ message: "Purchase not found" });
    }
    res.status(200).json(purchases);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving purchase", error });
  }
};

exports.updatePurchase = async (req, res) => {
  try {
    const { purchaseId } = req.params;
    const purchaseData = req.body;

    const existingPurchase = await Purchase.findById(purchaseId);
    if (!existingPurchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    // Reverse stock changes
    for (const item of existingPurchase.purchasedItems) {
      if (item.isSerialized) {
        await SerializedStock.deleteMany({ purchase_id: purchaseId });
      } else {
        await NonSerializedStock.deleteMany({ purchase_id: purchaseId });
      }
    }

    // Reverse supplier account changes
    const supplierAccount = await Account.findOne({
      account_owner_type: "Supplier",
      related_party_id: existingPurchase.supplier
    });

    if (!supplierAccount) {
      return res.status(404).json({ message: 'Supplier account not found' });
    }

    supplierAccount.balance += existingPurchase.grand_total;
    await supplierAccount.save();

    // Update purchase data
    const batchNo = `BATCH-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    purchaseData.purchasedItems = purchaseData.purchasedItems.map((item) => {
      if (item.isSerialized && item.serializedItems) {
        item.serializedItems = item.serializedItems.map((itm) => ({
          ...itm,
          batch_number: batchNo,
        }));
      }
      return {
        ...item,
        batch_number: batchNo,
      };
    });

    const updatedPurchase = await Purchase.findByIdAndUpdate(purchaseId, purchaseData, { new: true });

    // Update stock
    for (const item of updatedPurchase.purchasedItems) {
      if (item.isSerialized) {
        for (const serializedItem of item.serializedItems) {
          await SerializedStock.create({
            item_id: item.item_id,
            purchase_id: updatedPurchase._id,
            serialNumber: serializedItem.serialNumber,
            batch_number: item.batch_number,
            purchaseDate: updatedPurchase.purchaseDate,
            unitCost: serializedItem.unitCost,
            sellingPrice: serializedItem.sellingPrice,
            status: "Available",
          });
        }
      } else {
        await NonSerializedStock.create({
          item_id: item.item_id,
          purchase_id: updatedPurchase._id,
          batch_number: item.batch_number,
          purchaseDate: updatedPurchase.purchaseDate,
          purchaseQty: item.purchaseQty,
          availableQty: item.purchaseQty,
          unitCost: item.unitCost,
          sellingPrice: item.sellingPrice,
          unit: item.unit,
        });
      }
    }

    // Update supplier account
    supplierAccount.balance -= updatedPurchase.grand_total;
    await supplierAccount.save();

        // Remove transaction record
        await Transaction.deleteOne({
          account_id: supplierAccount._id,
          amount: existingPurchase.grand_total * -1,
          reason: `Purchase: ${existingPurchase.referenceNumber}`
        });

    // Record the transaction
    const transaction = new Transaction({
      account_id: supplierAccount._id,
      amount: updatedPurchase.grand_total * -1,
      transaction_type: "Withdrawal",
      reason: `Purchase: ${updatedPurchase.referenceNumber}`,
      transaction_date: new Date(),
      balance_after_transaction: supplierAccount.balance,
    });

    await transaction.save();

    res.status(200).json({ message: "Purchase updated successfully", purchase: updatedPurchase });
  } catch (error) {
    console.error("Error updating purchase:", error);
    res.status(500).json({ message: "Error updating purchase", error });
  }
};

exports.deletePurchase = async (req, res) => {
  try {
    const { purchaseId } = req.params;

    const existingPurchase = await Purchase.findById(purchaseId);
    if (!existingPurchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    // Check payment status
    if (existingPurchase.payment_status !== 'Not Paid') {
      return res.status(400).json({ message: 'Only purchases with "Not Paid" status can be deleted' });
    }

    // Reverse stock changes
    for (const item of existingPurchase.purchasedItems) {
      if (item.isSerialized) {
        await SerializedStock.deleteMany({ purchase_id: purchaseId });
      } else {
        await NonSerializedStock.deleteMany({ purchase_id: purchaseId });
      }
    }

    // Reverse supplier account changes
    const supplierAccount = await Account.findOne({
      account_owner_type: "Supplier",
      related_party_id: existingPurchase.supplier
    });

    if (!supplierAccount) {
      return res.status(404).json({ message: 'Supplier account not found' });
    }

    supplierAccount.balance += existingPurchase.grand_total;
    await supplierAccount.save();

    // Delete purchase
    await Purchase.findByIdAndDelete(purchaseId);

    // Remove transaction record
    await Transaction.deleteOne({
      account_id: supplierAccount._id,
      amount: existingPurchase.grand_total * -1,
      reason: `Purchase: ${existingPurchase.referenceNumber}`
    });

    res.status(200).json({ message: "Purchase deleted successfully" });
  } catch (error) {
    console.error("Error deleting purchase:", error);
    res.status(500).json({ message: "Error deleting purchase", error });
  }
};
