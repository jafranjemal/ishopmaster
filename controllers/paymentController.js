const Payment = require("../models/Payment"); // Import payment model
const Account = require("../models/Account"); // Import account model
const Transaction = require("../models/Transaction"); // Import transaction model
const mongoose = require("mongoose");
const Purchase = require("../models/Purchase");
const Supplier = require("../models/Supplier");

// Helper function to update the account balance and transaction records
const updateAccountBalance = async (
  accountId,
  amount,
  transactionType,
  reason
) => {
  const account = await Account.findById(accountId);
  if (!account) {
    throw new Error("Account not found");
  }

  const newBalance =
    transactionType === "Deposit"
      ? account.balance + amount
      : account.balance - amount;

  // Create the transaction record
  const transaction = new Transaction({
    account_id: accountId,
    amount: transactionType === "Deposit" ? amount : amount * -1,
    transaction_type: transactionType,
    reason,
    balance_after_transaction: newBalance,
  });

  // Save transaction record
  await transaction.save();

  // Update account balance
  account.balance = newBalance;
  await account.save();
};

const fetchPurchaseReferenceNumbers = async (purchaseOrders) => {
  const purchaseIds = purchaseOrders.map((order) => order.purchase_id);
  const purchases = await Purchase.find(
    { _id: { $in: purchaseIds } },
    "referenceNumber"
  );
  const referenceMap = purchases.reduce((acc, purchase) => {
    acc[purchase._id] = purchase.referenceNumber;
    return acc;
  }, {});
  return purchaseOrders
    .map((order) => {
      const referenceNumber = referenceMap[order.purchase_id];
      return `Purchase ${referenceNumber} Due amount = Rs. ${Number(
        order.paidAmount
      ).toLocaleString()}`;
    })
    .join(", ");
};

const fetchSupplierName = async (supplierId) => {
  const supplier = await Supplier.findById(supplierId);
  return supplier ? supplier.supplier_id : "Unknown Supplier";
};

const generateTransactionReason = async (transactionType, references) => {
  const supplierName = await fetchSupplierName(references.supplier);
  const purchaseOrdersWithReferences = await fetchPurchaseReferenceNumbers(
    references.purchase_orders
  );
  return `${transactionType}: (${supplierName}) for [${purchaseOrdersWithReferences}]`;
};

// Controller function to handle payments
exports.addPayment = async (req, res) => {
  const {
    amount,
    description,
    from_account_id,
    payment_methods,
    references,
    to_account_id,
    transaction_type,
  } = req.body;

  try {
    // Create and save the payment record
    const reason = await generateTransactionReason(
      transaction_type,
      references
    );

    const payment = new Payment({
      amount,
      description,
      from_account_id,
      payment_methods,
      references,
      to_account_id,
      transaction_type,
    });
    await payment.save();

    // Update balances for involved accounts
    if (to_account_id) {
      await updateAccountBalance(
        to_account_id,
        amount,
        "Deposit",
        `Payment for ${reason}`
      );
    }

    await updateAccountBalance(from_account_id, amount, "Withdrawal", reason);

    // Handle supplier payment-specific updates
    if (transaction_type === "Supplier Payment") {
      await handleSupplierPaymentUpdates(references.purchase_orders);
    }

    res.status(201).json({
      message: "Payment processed successfully",
      payment,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error processing payment",
      error: error.message,
    });
  }
};

/**
 * Handles updating supplier payment-related purchase orders
 * @param {Array} purchaseOrders - List of purchase orders to update
 */
const handleSupplierPaymentUpdates = async (purchaseOrders) => {
  try {
    const updatePurchaseOrder = async ({ purchase_id, paidAmount }) => {
      const purchase = await Purchase.findById(purchase_id);
      if (purchase) {
        const { payment_due_amount: oldDue, grand_total: grandTotal } =
          purchase;
        const newDueAmount = oldDue - paidAmount;
        const newStatus =
          newDueAmount === 0
            ? "Paid"
            : newDueAmount === grandTotal
            ? "Not Paid"
            : "Partial";

        await purchase.updateOne({
          payment_due_amount: newDueAmount,
          payment_status: newStatus,
        });
      }
    };

    // Update all purchase orders in parallel
    await Promise.all(purchaseOrders.map(updatePurchaseOrder));
  } catch (error) {
    console.error("Error updating supplier payment purchase orders:", error);
    throw error;
  }
};

// Controller function to get all payments
exports.getPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate('from_account_id to_account_id')
      .populate('references.supplier')
      .populate('references.employee')
      .populate('references.customer')
      .populate( 
        'references.purchase_orders.purchase_id'
        
       )
      .populate({
        path: 'references.sale',
        populate: {
          path: 'customer items.item_id'
        }
      }).sort({ transaction_date: -1 });

    res.status(200).json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({
      message: 'Error fetching payments',
      error: error.message
    });
  }
};

// With pagination and filtering
exports.getPaymentsWithOptions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      transaction_type,
      start_date,
      end_date
    } = req.query;

    const query = {};

    // Add filters
    if (transaction_type) {
      query.transaction_type = transaction_type;
    }

    if (start_date || end_date) {
      query.transaction_date = {};
      if (start_date) query.transaction_date.$gte = new Date(start_date);
      if (end_date) query.transaction_date.$lte = new Date(end_date);
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      populate: [
        { path: 'from_account_id' },
        { path: 'to_account_id' },
        { path: 'references.supplier' },
        { path: 'references.employee' },
        { path: 'references.customer' },
        {
          path: 'references.purchase_orders.purchase_id',
          populate: {
            path: 'supplier items.item_id'
          }
        },
        {
          path: 'references.sale',
          populate: {
            path: 'customer items.item_id'
          }
        }
      ]
    };

    const payments = await Payment.paginate(query, options);

    res.status(200).json({
      payments: payments.docs,
      totalPages: payments.totalPages,
      currentPage: payments.page,
      totalRecords: payments.totalDocs
    });

  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({
      message: 'Error fetching payments',
      error: error.message
    });
  }
};
// Controller to fetch a payment by its ID
exports.getPaymentById = async (req, res) => {
  const { paymentId } = req.params;
  try {
    const payment = await Payment.findById(paymentId).populate(
      "from_account_id to_account_id"
    );
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }
    res.status(200).json(payment);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error fetching payment", error: error.message });
  }
};

// Controller to update a payment
exports.updatePayment = async (req, res) => {
  const { paymentId } = req.params;
  const {
    payment_method,
    amount,
    from_account_id,
    transaction_type,
    reason,
    to_account_id,
    cheque_number,
    card_details,
    bank_transfer_details,
  } = req.body;

  try {
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    // Update the payment details
    payment.payment_method = payment_method || payment.payment_method;
    payment.amount = amount || payment.amount;
    payment.from_account_id = from_account_id || payment.from_account_id;
    payment.transaction_type = transaction_type || payment.transaction_type;
    payment.reason = reason || payment.reason;
    payment.to_account_id = to_account_id || payment.to_account_id;
    payment.cheque_number = cheque_number || payment.cheque_number;
    payment.card_details = card_details || payment.card_details;
    payment.bank_transfer_details =
      bank_transfer_details || payment.bank_transfer_details;

    await payment.save();

    // Return updated payment
    res.status(200).json({ message: "Payment updated successfully", payment });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error updating payment", error: error.message });
  }
};

// Controller to delete a payment
exports.deletePayment = async (req, res) => {
  const { paymentId } = req.params;
  try {
    const payment = await Payment.findByIdAndDelete(paymentId);
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    // Optionally, you can reverse the account balance changes here
    res.status(200).json({ message: "Payment deleted successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error deleting payment", error: error.message });
  }
};

exports.getPaymentsByPurchaseId = async (req, res) => {
  try {
    const { purchaseId } = req.params;
    const payments = await Payment.aggregate([
      { $unwind: "$references.purchase_orders" },
      {
        $match: {
          "references.purchase_orders.purchase_id":
           new mongoose.Types.ObjectId(purchaseId),
        },
      },
      {
        $lookup: {
          from: "accounts",
          localField: "from_account_id",
          foreignField: "_id",
          as: "from_account",
        },
      },
      {
        $lookup: {
          from: "accounts",
          localField: "to_account_id",
          foreignField: "_id",
          as: "to_account",
        },
      },
      {
        $lookup: {
          from: "suppliers",
          localField: "references.supplier",
          foreignField: "_id",
          as: "supplier",
        },
      },
      { $unwind: "$from_account" },
      { $unwind: "$to_account" },
      { $unwind: { path: "$supplier", preserveNullAndEmptyArrays: true } },
      { $sort : {"transaction_date": -1}}
    ]);
    if (payments.length === 0) {
      return res
        .status(404)
        .json({ message: "No payments found for this purchase ID" });
    }
    res.status(200).json(payments);
  } catch (error) {
    console.error("Error retrieving payments:", error);
    res.status(500).json({ message: "Error retrieving payments", error });
  }
};

// Controller to get payments by account ID
exports.getPaymentsByAccount = async (req, res) => {
  const { accountId } = req.params;
  try {
    const payments = await Payment.find({
      $or: [{ from_account_id: accountId }, { to_account_id: accountId }],
    }).populate("from_account_id to_account_id");

    res.status(200).json(payments);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error fetching payments by account",
      error: error.message,
    });
  }
};
// Controller to get payments by date range
exports.getPaymentsByDateRange = async (req, res) => {
  const { startDate, endDate } = req.query; // Expect startDate and endDate as query params

  if (!startDate || !endDate) {
    return res
      .status(400)
      .json({ message: "Start date and end date are required" });
  }

  try {
    const payments = await Payment.find({
      payment_date: { $gte: new Date(startDate), $lte: new Date(endDate) },
    }).populate("from_account_id to_account_id");

    res.status(200).json(payments);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error fetching payments by date range",
      error: error.message,
    });
  }
};
// Controller to get payment summary (total amount)
exports.getPaymentSummary = async (req, res) => {
  const { accountId, startDate, endDate } = req.query;

  try {
    let filter = {};

    if (accountId) {
      filter = {
        ...filter,
        $or: [{ from_account_id: accountId }, { to_account_id: accountId }],
      };
    }

    if (startDate && endDate) {
      filter.payment_date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const payments = await Payment.find(filter);

    const totalPaid = payments.reduce(
      (sum, payment) => sum + payment.amount,
      0
    );

    res.status(200).json({ totalPaid });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error fetching payment summary",
      error: error.message,
    });
  }
};
