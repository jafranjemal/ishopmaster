const SalesInvoice = require("../models/SalesInvoice");
const Account = require("../models/Account");
const Transaction = require("../models/Transaction");
const SerializedStock = require("../models/SerializedStock");
const NonSerializedStock = require("../models/NonSerializedStock");
const Payment = require("../models/Payment");
const Shift = require("../models/Shift");
const { ApiError } = require("../utility/ApiError");
const Ticket = require("../models/Ticket");
const warrantyController = require("./warrantyController");
const StockLedger = require("../models/StockLedger");
const Item = require("../models/Items");
const { logToLedger, syncUpward } = require("../services/inventoryService");
const WarrantyPolicy = require("../models/WarrantyPolicy");
const CustomerDevice = require("../models/CustomerDevice");
const ItemVariant = require("../models/ItemVariantSchema");

async function updateInventory(items) {
  console.log("updateInventory start...");
  try {
    const { logToLedger, syncUpward } = require("../services/inventoryService");

    for (const item of items) {
      const { item_id, variant_id, quantity, serialNumbers, isSerialized, batch_number, itemName, price } = item;

      if (isSerialized && serialNumbers && serialNumbers.length > 0) {
        await SerializedStock.updateMany(
          { serialNumber: { $in: serialNumbers } },
          { $set: { status: "Sold", sold_date: new Date() } }
        );
        for (const sn of serialNumbers) {
          await logToLedger({
            item_id,
            variant_id,
            qty: -1,
            movementType: "Sale-Out",
            batch_number,
            sellingPrice: price,
            serialNumber: sn,
            memo: `Sale: ${itemName} (SN: ${sn})`
          });
        }
      } else {
        const stockRecord = await NonSerializedStock.findOne({
          item_id,
          variant_id: variant_id || null,
          batch_number
        });

        if (stockRecord) {
          stockRecord.availableQty = Math.max(0, stockRecord.availableQty - quantity);
          stockRecord.soldQty = (stockRecord.soldQty || 0) + quantity;
          await stockRecord.save();

          await logToLedger({
            item_id,
            variant_id,
            qty: -quantity,
            movementType: "Sale-Out",
            batch_number,
            sellingPrice: price,
            memo: `Sale: ${itemName}`
          });
        }
      }
      await syncUpward(item_id, variant_id);
    }
    console.log("updateInventory end...");
  } catch (error) {
    console.error("Error in updateInventory:", error);
    throw error;
  }
}

// Helper: Logging sales in shift
async function logSaleInShift(shiftId, invoiceId, total_amount, payment_methods = []) {
  try {
    const shift = await Shift.findById(shiftId);
    if (!shift) throw new Error("Shift not found");

    const cashPaid = payment_methods
      .filter(pm => pm.method === "Cash")
      .reduce((acc, pm) => acc + pm.amount, 0);

    const nonCashPaid = total_amount - cashPaid;

    shift.sales.push(invoiceId);
    shift.totalSales += total_amount;
    shift.totalCashSales = (shift.totalCashSales || 0) + cashPaid;
    shift.totalNonCashSales = (shift.totalNonCashSales || 0) + nonCashPaid;
    shift.totalTransactions += 1;

    await shift.save();
  } catch (error) {
    console.error("Error logging sale in shift:", error);
    throw error;
  }
}

async function updateInventoryReversal(items) {
  try {
    console.log("updateInventoryReversal() started ....\n");
    for (const item of items) {
      const { item_id, variant_id, quantity, serialNumbers, isSerialized, batch_number, itemName, price } = item;

      if (isSerialized && serialNumbers) {
        await SerializedStock.updateMany(
          { serialNumber: { $in: serialNumbers } },
          { $set: { status: "Available", sold_date: null } }
        );
        for (const sn of serialNumbers) {
          await logToLedger({
            item_id,
            variant_id,
            qty: 1,
            movementType: "Reversal-In",
            batch_number,
            serialNumber: sn,
            memo: `Sale Reversal: ${itemName}`
          });
        }
      } else {
        await NonSerializedStock.updateOne(
          { item_id, variant_id: variant_id || null, batch_number },
          { $inc: { soldQty: -quantity, availableQty: quantity } }
        );
        await logToLedger({
          item_id,
          variant_id,
          qty: quantity,
          movementType: "Reversal-In",
          batch_number,
          memo: `Sale Reversal: ${itemName}`
        });
      }
      await syncUpward(item_id, variant_id);
    }
  } catch (error) {
    console.error("Error during inventory reversal:", error);
    throw error;
  }
}

async function processPayment(invoiceId, paymentDetails) {
  console.log("processPayment start...", paymentDetails);

  const invoice = await SalesInvoice.findOne({ invoice_id: invoiceId });
  if (!invoice) throw new Error("Invoice not found");

  const customerAccount = await Account.findOne({
    account_owner_type: "Customer",
    related_party_id: invoice.customer,
  });

  if (!customerAccount) throw new Error("Customer account not found");

  let totalPaid = 0;
  let totalAmount = 0;

  // Payment Mapping Service
  const { resolveAccountForMethod } = require("../services/paymentMappingService");

  for (const payment of paymentDetails) {
    const { method, amount, target_account_id } = payment;
    if (amount && amount > 0) {
      totalAmount += amount;

      // 1. Resolve Target Account Dynamically
      let targetAccountId = payment.target_account_id;
      if (!targetAccountId) {
        targetAccountId = await resolveAccountForMethod(method);
      }
      const targetAccount = await Account.findById(targetAccountId);

      if (!targetAccount) throw new Error(`Target account for method ${method} not found.`);

      // 2. Deposit logic for Target Account (Company Cash/Bank)
      // Asset: Deposit = Increase (+)
      const targetTransaction = new Transaction({
        account_id: targetAccount._id,
        amount: amount,
        transaction_type: "Deposit",
        reason: `Payment for Invoice ${invoice.invoice_id} via ${method}`,
        balance_after_transaction: targetAccount.balance + amount,
      });
      await targetTransaction.save();

      targetAccount.balance += amount;
      await targetAccount.save();

      // 3. Create Payment Record
      // from: Customer, to: Target Company Account
      const paymentRecord = new Payment({
        from_account_id: customerAccount._id, // Source: Customer
        to_account_id: targetAccount._id,     // Destination: Mapped Company Account
        amount: amount,
        payment_methods: [{ method: method, amount: amount }], // Track specific chunk
        transaction_type: "Sale",
        references: {
          customer: invoice.customer,
          sale: invoice._id,
        },
        description: `Payment for Invoice ${invoice.invoice_id} via ${method}`,
      });
      await paymentRecord.save();

      // 4. Update Invoice Paid Amount
      totalPaid += amount;
    }
  }

  // Handle Overpayment / Credit Balance logic if needed
  // Note: Previous logic handled split payments and overpayments complexly. 
  // Simplified here to Focus on CORRECT ROUTING.
  // Ideally, if (totalPaid > invoice.total_amount), the excess should be credited to Customer Account balance.

  if (totalPaid > invoice.total_amount) {
    const overpaid = totalPaid - invoice.total_amount;
    // Credit the customer account (Deposit)
    const creditTransaction = new Transaction({
      account_id: customerAccount._id,
      amount: overpaid,
      transaction_type: "Deposit",
      reason: `Overpayment Credit from Invoice ${invoice.invoice_id}`,
      balance_after_transaction: customerAccount.balance + overpaid
    });
    await creditTransaction.save();
    customerAccount.balance += overpaid;
    await customerAccount.save();
  }

  const invoiceStatus =
    totalPaid === 0
      ? "Unpaid"
      : totalPaid >= invoice.total_amount
        ? "Paid"
        : "Partially paid";

  invoice.status = invoiceStatus;
  invoice.total_paid_amount = Math.min(totalPaid, invoice.total_amount); // Cap at total? Or allow tracking overpayment? Typically cap paid field, credit rest.

  if (invoiceStatus === "Partially paid" || invoiceStatus === "Unpaid") {
    // update balance as a Due for customer account
    const dueAmount = invoice.total_amount - totalPaid;
    // Debiting customer account for Due is handled in handleCreditSale or similar
    await handleCreditSale(invoice.customer, dueAmount, invoice.invoice_id);
  }

  await invoice.save();
  console.log("processPayment end...");
}

async function handleCreditSale(customerId, totalAmount, invoice_id) {
  // Update customer account with due amount
  console.log("handleCreditSale start...", totalAmount);
  // Default recovery method is Cash unless specified otherwise
  const method = "Cash";
  const { resolveAccountForMethod } = require("../services/paymentMappingService");

  const invoice = await SalesInvoice.findOne({ invoice_id: invoice_id });
  if (!invoice) throw new Error("Invoice not found");

  const customerAccount = await Account.findOne({
    related_party_id: customerId,
    account_owner_type: "Customer",
  });
  if (!customerAccount) throw new Error("Customer account not found");

  // Resolve target company account for "Cash" (or recovery method)
  const companyAccountId = await resolveAccountForMethod(method);
  const companyAccount = await Account.findById(companyAccountId);
  if (!companyAccount) throw new Error("Target Company Account for credit recovery not found");

  if (customerAccount.balance >= totalAmount) {
    // 1. Customer has sufficient balance (Prepaid/Deposit usage)
    // DEDUCT from Customer Account (Withdrawal) -> DEPOSIT to Company Account

    // A. Deposit to Company
    const transaction = new Transaction({
      account_id: companyAccount._id,
      amount: totalAmount,
      transaction_type: "Deposit",
      reason: `Payment Recover from Customer Account for Invoice ${invoice.invoice_id}`,
      balance_after_transaction: companyAccount.balance + totalAmount,
    });
    await transaction.save();

    companyAccount.balance += totalAmount;
    await companyAccount.save();

    // B. Create Payment Record
    const paymentRecord = new Payment({
      from_account_id: invoice.customer,
      to_account_id: companyAccount._id,
      amount: totalAmount,
      payment_methods: [{ method: "Account", amount: totalAmount, details: { account_number: customerAccount._id } }],
      transaction_type: "Sale",
      references: {
        customer: invoice.customer,
        sale: invoice._id,
      },
      description: `Payment Recover from Customer Account for Invoice ${invoice.invoice_id}`,
    });
    await paymentRecord.save();

    // C. Update Invoice to Paid
    invoice.status = "Paid";
    invoice.total_paid_amount = invoice.total_amount;
    invoice.payment_methods.push({
      method: "Account",
      amount: invoice.total_amount,
      details: { account_number: customerAccount._id }
    });
    await invoice.save();

    // D. DEDUCT from Customer (Withdrawal)
    const customer_transaction = new Transaction({
      account_id: customerAccount._id,
      amount: totalAmount,
      transaction_type: "Withdrawal",
      reason: `Auto Payment Deduct for Credit Sale Invoice ${invoice_id}`,
      balance_after_transaction: customerAccount.balance - totalAmount,
    });
    await customer_transaction.save();

    customerAccount.balance -= totalAmount;
    await customerAccount.save();

  } else {
    // 2. Insufficient Balance (Credit Sale)
    // Simply record the DEBT on the customer account.
    // No money moves to Company yet.

    const transaction = new Transaction({
      account_id: customerAccount._id,
      amount: totalAmount,
      transaction_type: "Withdrawal",
      reason: `Credit Sale Invoice Created ${invoice_id}`,
      balance_after_transaction: customerAccount.balance - totalAmount,
    });

    await transaction.save();

    customerAccount.balance -= totalAmount;
    await customerAccount.save();
  }

  console.log("handleCreditSale end...");
}

// End of helper functions before createSalesInvoice

async function createSalesInvoice(
  customerId,
  items,
  payment_methods = [],
  transactionType,
  userId,
  shiftId,
  notes,
  invoice_type,
  serviceItems,
  ticketId = null,
  global_discount_type = "Fixed",
  global_discount_value = 0
) {
  // --- SHIFT GATE: Validate Terminal Status ---
  if (!shiftId) throw new ApiError(400, "Terminal ID required for processing");
  const activeShift = await Shift.findById(shiftId);
  if (!activeShift) throw new ApiError(404, "Terminal session not found");
  if (activeShift.status !== 'active') {
    throw new ApiError(403, `Terminal Locked! Status: ${activeShift.status.toUpperCase()}. Please refresh your workstation.`);
  }

  // --- BUSINESS GUARD: VALIDATE ITEM DATA ---
  for (const item of items) {
    if (item.item_id) {
      const dbItem = await Item.findById(item.item_id);
      if (dbItem) {
        // Force the DB truth regarding serialization if front-end is inconsistent
        item.isSerialized = dbItem.serialized;
      }
    }
  }

  const itemTotal = items.reduce((total, item) => total + item.totalPrice, 0);
  const serviceTotal =
    serviceItems && serviceItems.reduce((total, item) => total + item.total, 0);
  const total_paid_amount = payment_methods.reduce(
    (total, item) => total + item.amount,
    0
  );

  const totalAmount = itemTotal + serviceTotal;
  const dueAmount = totalAmount - total_paid_amount;

  // Credit Limit Check
  if (dueAmount > 0) {
    const Customer = require("../models/Customer"); // Ensure Customer model is available
    const customer = await Customer.findById(customerId);
    const customerAccount = await Account.findOne({
      related_party_id: customerId,
      account_owner_type: "Customer",
    });

    if (customer && customerAccount) {
      const currentBalance = customerAccount.balance; // Negative means they owe
      const projectedBalance = currentBalance - dueAmount;

      // Credit Limit Logic:
      // - null or undefined = UNLIMITED CREDIT (no validation)
      // - 0 = CASH ONLY (no credit allowed)
      // - positive number = SPECIFIC LIMIT (debt capped at that amount)
      const creditLimit = customer.creditLimit;

      if (creditLimit === null || creditLimit === undefined) {
        // Unlimited credit - no validation needed
        console.log(`Customer ${customer.first_name} has unlimited credit`);
      } else if (creditLimit === 0) {
        // Cash only - no credit allowed
        throw new ApiError(
          400,
          `Cash Only Customer!\n` +
          `Customer: ${customer.first_name} ${customer.last_name || ""}\n` +
          `Credit is not allowed for this customer.\n` +
          `Due Amount: Rs. ${dueAmount.toFixed(2)}`
        );
      } else {
        // Specific credit limit
        if (projectedBalance < -creditLimit) {
          throw new ApiError(
            400,
            `Credit Limit Exceeded!\n` +
            `Customer: ${customer.first_name} ${customer.last_name || ""}\n` +
            `Credit Limit: Rs. ${creditLimit.toFixed(2)}\n` +
            `Current Balance: Rs. ${Math.abs(currentBalance).toFixed(2)} ${currentBalance < 0 ? 'owed' : 'credit'}\n` +
            `This Sale: Rs. ${dueAmount.toFixed(2)}\n` +
            `Projected Debt: Rs. ${Math.abs(projectedBalance).toFixed(2)}`
          );
        }
      }
    }
  }

  console.log("totalAmount - ", totalAmount);
  console.log("total_paid_amount - ", total_paid_amount);

  // --- FORENSIC SNAPSHOTTING: Warranty & Refurb Tags ---
  for (const item of items) {
    if (item.isSerialized && item.serialNumbers && item.serialNumbers.length > 0) {
      // Fetch the specific stock record for the FIRST serial number provided
      const stock = await SerializedStock.findOne({ serialNumber: item.serialNumbers[0] }).populate('warrantyPolicyId');

      if (stock) {
        item.refurb_tags = stock.refurb_tags || [];

        if (stock.warrantyPolicyId) {
          const policy = stock.warrantyPolicyId;
          const saleDate = new Date();
          const replExpiry = new Date(saleDate);
          replExpiry.setDate(replExpiry.getDate() + (policy.phase1_days || 0));

          const servExpiry = new Date(replExpiry);
          servExpiry.setDate(servExpiry.getDate() + (policy.phase2_days || 0));

          item.warranty_snapshot = {
            policy_name: policy.name,
            phase1_days: policy.phase1_days,
            phase2_days: policy.phase2_days,
            terms_list: policy.terms_list,
            replacement_expiry: replExpiry,
            service_expiry: servExpiry
          };
        }

        // --- CUSTOMER DEVICE REGISTRY (VARIANT-AWARE) ---
        try {
          const variant = await ItemVariant.findById(item.variant_id).populate('item_id');

          if (variant && variant.item_id) {
            const baseItem = variant.item_id;

            // Only create CustomerDevice record if the sold item is actually a DEVICE (Phone, Tablet, etc.)
            // We don't want to track serialized batteries or accessories in the "Device Hub"
            if (baseItem.category === 'Device') {
              for (const sn of item.serialNumbers) {
                await CustomerDevice.findOneAndUpdate(
                  { serialNumber: sn },
                  {
                    serialNumber: sn,
                    itemId: variant.item_id._id,
                    variantId: variant._id,
                    deviceName: variant.variantName,
                    brandId: variant.item_id?.manufacturerId,
                    modelId: variant.item_id?.phoneModelId,

                    // Map flexible attributes
                    color: variant.variantAttributes.find(a => a.key === 'Color')?.value || '',
                    storage: variant.variantAttributes.find(a => a.key === 'Storage')?.value || '',
                    RAM: variant.variantAttributes.find(a => a.key === 'RAM')?.value || '',
                    network: variant.variantAttributes.find(a => a.key === 'Network')?.value || '',

                    owner: customerId,
                    source: 'Sales',
                    isExternalPurchase: false,
                    status: 'Active',

                    warranty: {
                      purchaseDate: new Date()
                    },

                    refurbNotes: item.refurb_tags || [],
                  },
                  { upsert: true, new: true, setDefaultsOnInsert: true }
                );
              }
            }
          }
        } catch (err) {
          console.error("CustomerDevice registry failed: Check variant_id mapping", err);
        }

      }
    }
  }


  // Create the sales invoice
  const invoice = new SalesInvoice({
    customer: customerId,
    items,
    total_amount: totalAmount,
    total_paid_amount: total_paid_amount,
    payment_methods: payment_methods,
    transaction_type: transactionType,
    user_id: userId,
    shift_id: shiftId,
    notes,

    invoice_type,
    serviceItems,
    ticketId,
    global_discount_type,
    global_discount_value,
  });

  if (ticketId) {
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) throw Error("Ticket not found");

    ticket.invoiceId = invoice._id;

    // Auto-complete ticket on payment generation if it's open
    if (ticket.ticketStatus !== 'Completed') {
      ticket.ticketStatus = 'Completed';
      ticket.repairStatus = 'Completed';
      ticket.statusHistory.push({
        status: 'Completed',
        timestamp: new Date(),
        updatedBy: userId
      });
    }

    await ticket.save();

    invoice.ticketId = ticket._id;
  }

  await invoice.save();

  // Handle payments sales
  // await handleCashSale(totalAmount, invoice.invoice_id, paymentMethods);
  await processPayment(invoice.invoice_id, payment_methods);

  // Update inventory
  await updateInventory(items);

  // Update Sales shift
  await logSaleInShift(shiftId, invoice.invoice_id, totalAmount, payment_methods);

  // Generate separate warranty records
  try {
    await warrantyController.generateWarrantiesForInvoice(invoice._id);
  } catch (wErr) {
    console.error("Error generating warranties:", wErr);
    // We don't fail the whole sale if warranty generation fails, but log it
  }

  const lastInvoice = await SalesInvoice.findOne({
    _id: invoice._id,
  });

  return lastInvoice;
}
async function createReversalSalesInvoice(
  customerId,
  items,
  paymentMethods,
  transactionType,
  userId,
  shiftId,
  notes,
  invoice_type,
  serviceItems,
  ticketId
) {
  try {
    console.log("createReversalSalesInvoice() started...\n");
    console.log("#######################\n");
    console.log("invoice_type", invoice_type);
    console.log("paymentMethods", paymentMethods);
    console.log("serviceItems", serviceItems);
    console.log("ticketId", ticketId);

    console.log("#######################\n");
    const itemTotal = items.reduce((total, item) => total + item.totalPrice, 0);
    const serviceItemsArray = Array.isArray(serviceItems) ? serviceItems : [];
    const serviceTotal = serviceItemsArray.reduce(
      (total, item) => total + item.total,
      0
    );
    //const serviceTotal = serviceItems && serviceItems.reduce((total, item) => total + item.total, 0);
    const totalAmount = itemTotal + serviceTotal;
    const total_paid_amount = paymentMethods.reduce(
      (total, item) => total + item.amount,
      0
    );

    console.log("#######################\n");
    console.log("createReversalSalesInvoice()-> totalAmount", totalAmount);
    console.log(
      "createReversalSalesInvoice()->  total_paid_amount",
      total_paid_amount
    );

    console.log("#######################\n");
    // Create the sales invoice
    const invoice = new SalesInvoice({
      customer: customerId,
      items,
      total_amount: totalAmount,
      total_paid_amount,
      payment_methods: paymentMethods,
      transaction_type: transactionType,
      user_id: userId,
      shift_id: shiftId,
      notes,

      invoice_type,
      serviceItems,
      ticketId,
    });

    await invoice.save();

    // Handle payments sales
    // await handleCashSale(totalAmount, invoice.invoice_id, paymentMethods);
    await paymentProcessFromAccount(
      invoice.customer,
      invoice.total_amount,
      invoice.invoice_id
    );

    // Update inventory
    await updateInventory(items);

    // Update Sales shift
    await logSaleInShift(shiftId, invoice.invoice_id, totalAmount);

    const lastInvoice = await SalesInvoice.findOne({
      _id: invoice._id,
    });

    console.log("createReversalSalesInvoice() ended...\n");
    return lastInvoice;
  } catch (error) {
    // Handle errors
    console.log("createReversalSalesInvoice() failed", error);
    throw error;
  }
}

/**
 * Settles a due payment for an existing invoice.
 *
 * @param {Object} existingInvoice - The existing invoice object.
 * @param {Object} updates - The updated payment details.
 * @returns {Object} - The result of the due payment settlement.
 */
async function settleDuePayment(existingInvoice, updates) {
  try {
    console.log("settleDuePayment started..");
    // Validate input data
    if (!existingInvoice || !updates) {
      throw new Error("Invalid input data");
    }

    // Check if company account exists
    const companyAccount = await Account.findOne({
      account_owner_type: "Company",
    });
    if (!companyAccount) {
      throw new Error("Company account not found");
    }

    // Calculate settlement amount
    const settlementAmount =
      updates.total_paid_amount - existingInvoice.total_paid_amount;

    // Get new payment methods
    const newPaymentMethods = updates.payment_methods.filter(
      (newMethod) =>
        !existingInvoice.payment_methods.some(
          (existingMethod) =>
            existingMethod.method === newMethod.method &&
            existingMethod.amount === newMethod.amount
        )
    );

    // Loop through new payment methods and settle due
    for (const payment of newPaymentMethods) {
      const { method, amount, target_account_id } = payment;

      // 1. Resolve Target Account
      let targetAccountId = target_account_id;
      let targetAccount = null;

      if (targetAccountId) {
        targetAccount = await Account.findById(targetAccountId);
      } else {
        targetAccount = companyAccount; // Default if not specified
      }

      if (!targetAccount) throw new Error("Target account not found");

      // Create a new transaction
      const transaction = new Transaction({
        account_id: targetAccount._id,
        amount: paymentAmountToApply,
        transaction_type: "Deposit",
        reason: `Due Payment Settled for Invoice ${existingInvoice.invoice_id} via ${method}`,
        description: `Settling due payment of ${paymentAmountToApply} for invoice ${existingInvoice.invoice_id} using ${method}`,
        balance_after_transaction:
          targetAccount.balance + paymentAmountToApply,
      });
      await transaction.save();

      // Update company account balance
      targetAccount.balance += paymentAmountToApply;
      await targetAccount.save();

      // Update invoice status
      existingInvoice.status =
        settlementAmount + existingInvoice.total_paid_amount >=
          existingInvoice.total_amount
          ? "Paid"
          : "Partially paid";
      existingInvoice.total_paid_amount += paymentAmountToApply;
      await existingInvoice.save();

      // Log settlement process
      console.log(
        `Due payment settled for invoice ${existingInvoice.invoice_id} using ${method}`
      );
    }

    return {
      message: "Due payment settled successfully",
      invoice: existingInvoice,
    };
  } catch (error) {
    console.error(error);
    return {
      message: "Error settling due payment",
      error: error.message,
    };
  }
}

// Helper function to check if items are equal based on specific fields
function areItemsEqual(updates, existing) {
  const fieldsToCheck = [
    "barcode",
    "discount",
    "isSerialized",
    "itemImage",
    "itemName",
    "item_id",
    "lastSellingPrice",
    "price",
    "quantity",
    "serialNumbers",
    "totalPrice",
    "_id",
  ];

  return fieldsToCheck.every((field) => {
    const updateValue = updates[field];
    const existingValue = existing[field];

    // Convert _id to string for proper comparison
    if (field === "_id" || field === "item_id") {
      return String(updateValue) === String(existingValue);
    }

    // Handle array comparison (e.g., serialNumbers)
    if (Array.isArray(updateValue) && Array.isArray(existingValue)) {
      const areArraysEqual =
        updateValue.length === existingValue.length &&
        updateValue.every((val, index) => val === existingValue[index]);

      if (!areArraysEqual) {
        console.log(
          `Field changed: ${field}, Old Value: ${JSON.stringify(
            existingValue
          )}, New Value: ${JSON.stringify(updateValue)}`
        );
      }
      return areArraysEqual;
    }

    if (updateValue !== existingValue) {
      console.log(
        `Field changed: ${field}, Old Value: ${existingValue}, New Value: ${updateValue}`
      );
      return false; // Exit early if a difference is found
    }

    return true;
  });
}

// Create a new sales invoice
exports.createSalesInvoice = async (req, res) => {
  const {
    customer,
    items,
    payment_methods,
    transaction_type,
    user_id,
    shift_id,
    notes = "",

    invoice_type = "Sale",
    serviceItems = [],
    ticketId = null,
    global_discount_type = "Fixed",
    global_discount_value = 0,
  } = req.body;

  try {
    const invoice = await createSalesInvoice(
      customer,
      items,
      payment_methods,
      transaction_type,
      user_id,
      shift_id,
      notes,
      invoice_type,
      serviceItems,
      ticketId,
      global_discount_type,
      global_discount_value
    );
    res.status(201).json(invoice);
  } catch (error) {
    console.error("createSalesInvoice () failed", error);
    res.status(400).json({ message: error.message });
  }
};

// Get all sales invoices
/**
 * Retrieves all sales invoices, sorted by date.
 *
 * @async
 * @param {Object} req - The incoming request object.
 * @param {Object} res - The outgoing response object.
 * @returns {Promise<void>}
 */
exports.getAllSalesInvoices = async (req, res) => {
  try {
    const {
      search,
      limit = 10,
      skip = 0,
      startDate,
      endDate,
      customer,
      status,
      paymentMethod,
      minAmount,
      maxAmount
    } = req.query;

    let query = {};

    // Base Query Logic
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    if (customer) query.customer = customer;
    if (status) query.status = status;
    if (paymentMethod) query.payment_method = paymentMethod;
    if (minAmount || maxAmount) {
      query.total_amount = {};
      if (minAmount) query.total_amount.$gte = Number(minAmount);
      if (maxAmount) query.total_amount.$lte = Number(maxAmount);
    }

    const searchRegex = search ? { $regex: search, $options: "i" } : null;

    const pipeline = [
      { $match: query },
      {
        $lookup: {
          from: "customers",
          localField: "customer",
          foreignField: "_id",
          as: "customer_details",
        },
      },
      { $unwind: { path: "$customer_details", preserveNullAndEmptyArrays: true } },
    ];

    if (searchRegex) {
      pipeline.push({
        $match: {
          $or: [
            { invoice_id: searchRegex },
            { "customer_details.first_name": searchRegex },
            { "customer_details.last_name": searchRegex },
            { "customer_details.phone": searchRegex },
            { "items.barcode": searchRegex },
            { "items.serialNumbers": searchRegex },
          ],
        },
      });
    }

    pipeline.push(
      { $sort: { createdAt: -1 } },
      { $skip: Number(skip) },
      { $limit: Number(limit) }
    );

    const invoices = await SalesInvoice.aggregate(pipeline);

    // Populate remaining refs manually or via another lookup if needed
    // Note: Aggregate results are plain objects, we might need to populate them for consistency
    const populatedInvoices = await SalesInvoice.populate(invoices, [
      { path: "customer" },
      { path: "ticketId" },
      { path: "items.item_id" },
    ]);

    return res.status(200).json(populatedInvoices);
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }

    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// Get a single sales invoice by ID
exports.getSalesInvoiceById = async (req, res) => {
  const { id } = req.params;

  try {
    const invoice = await SalesInvoice.findById(id)
      .populate("customer")
      .populate("items.item_id");
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    res.status(200).json(invoice);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update a sales invoice

/**
 * processReturn:
 * Handles full return of a sales invoice, restoring stock and reversing finances.
 */
exports.processReturn = async (req, res) => {
  const { id } = req.params;
  const { notes = "Customer Return" } = req.body;

  try {
    const invoice = await SalesInvoice.findById(id).populate("customer");
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    if (invoice.status === "Returned" || invoice.status === "Reversed") {
      return res.status(400).json({ message: `Invoice already ${invoice.status}` });
    }

    // 1. Process Reversal (Financials + Inventory)
    await reverseSalesInvoice(id, `Return: ${notes}`);

    // 2. Update Status specifically to "Returned"
    invoice.status = "Returned";
    invoice.transaction_type = "Return";
    invoice.notes = (invoice.notes ? invoice.notes + " | " : "") + `Return Note: ${notes}`;
    await invoice.save();

    res.status(200).json({
      message: "Invoice returned successfully. Stock restored and financials reversed.",
      invoice
    });
  } catch (error) {
    console.error("Error during processReturn:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

// Main sales update function
exports.updateSalesInvoice = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const {
    customer,
    items,
    payment_methods,
    transaction_type,
    user_id,
    shift_id,
    invoice_type,
    notes = "",
    ticketId,
  } = req.body;

  console.log(`Request received to update invoice with ID: ${id}`);
  console.log("Updates received:", updates);

  try {
    // Step 1: Find the existing invoice
    const existingInvoice = await SalesInvoice.findById(id)
      .populate("customer")
      .populate("items.item_id");

    if (!existingInvoice) {
      console.log("Invoice not found in the database.");
      return res.status(404).json({ message: "Invoice not found" });
    }

    console.log("Existing invoice found:", existingInvoice._id);

    if (existingInvoice.status === "Reversed") {
      return res
        .status(404)
        .json({ message: "Invoice already Reversed, Cannot modify again" });
    }

    const oldDue =
      existingInvoice.total_amount - existingInvoice.total_paid_amount;
    const updatedDue = updates.total_amount - updates.total_paid_amount;

    if (oldDue > updatedDue) {
      const result = await settleDuePayment(existingInvoice, updates);
      return res.status(200).json(result);
    }

    // Step 2: Identify transaction_type
    if (transaction_type === "Sale") {
      const hasCustomerChange =
        updates.customer &&
        updates.customer.toString() !== existingInvoice.customer._id.toString();
      // const hasItemChanges =
      //   updates.items &&
      //   JSON.stringify(updates.items) !== JSON.stringify(existingInvoice.items);

      const existingInvoiceForCheck = await SalesInvoice.findById(id);
      const hasItemChanges =
        updates.items &&
        existingInvoice.items &&
        (updates.items.length !== existingInvoice.items.length || // If item count is different, something changed
          updates.items.some((updateItem) => {
            const existingItem = existingInvoiceForCheck.items.find(
              (item) => item._id === updateItem._id
            );
            return !existingItem || !areItemsEqual(updateItem, existingItem);
          }));

      console.log("Has customer change?", hasCustomerChange);
      console.log("Has item changes?", hasItemChanges);

      // return res.status(400).json({hasItemChanges})

      if (hasCustomerChange || hasItemChanges) {
        console.log(
          "Financial changes detected. Reversing and re-entering invoice."
        );

        if (existingInvoice.status === "Paid") {
          return res.status(400).json({
            message:
              "Cannot modify invoice with financial changes when it's already paid",
          });
        }

        if (hasItemChanges && existingInvoice.status === "Unpaid") {
          //only change items details and update the invoice

          // 1. update items
          Object.assign(existingInvoice, updates);
          // 2. update total amount and total paid amount
          // 3. remove credit transaction

          // Fetch all transactions related to the invoice
          const transactions = await Transaction.find({
            reason: { $regex: `${existingInvoice.invoice_id}`, $options: "i" },
          });

          // Process each transaction
          for (const transaction of transactions) {
            // Check if the transaction is for a credit sale
            console.log(`deleting credit tranaction for ${existingInvoice.invoice_id}`);
            await transaction.deleteOne();
          }

          await existingInvoice.save();

          // 4. Now check new payment method, if any methods found then create a transaction

          await processPayment(existingInvoice.invoice_id, payment_methods);

          // Return success response
          res.status(200).json({
            message: "Invoice updated successfully",
            invoice: existingInvoice,
          });

          // 5. update invoice status to unpaid if it's paid
        } else {
          //hasItemChanges && existingInvoice.status ==="paid" or partial paid
          //change entire invoice details and update the new invoice

          // Step 3a: Reverse the existing invoice
          await reverseSalesInvoice(existingInvoice._id, "Updating Sales");
          console.log("reverseSalesInvoice compledted...\n");
          console.log("create a new sales invoice started ...\n");
          const newInvoice = await createReversalSalesInvoice(
            customer,
            items,
            payment_methods,
            transaction_type,
            user_id,
            shift_id,
            notes || "",
            req.body.invoice_type,
            req.body.serviceItems,
            req.body.ticketId
          );
          console.log("create a new sales invoice ended ...\n");
          console.log("New invoice created:", newInvoice);
          // Return success response
          res.status(200).json({
            message: "Invoice reversed and re-entered successfully",
            invoice: newInvoice,
          });

        }



      } else {
        console.log(
          "No financial changes detected. Directly updating the invoice."
        );

        // Step 3a: Directly update the invoice for non-financial changes
        Object.assign(existingInvoice, updates);
        await existingInvoice.save();

        console.log("Invoice updated directly:", existingInvoice);

        // Return success response
        res.status(200).json({
          message: "Invoice updated successfully",
          invoice: existingInvoice,
        });
      }
    } else {
      // reversed only

      // Step 3a: Reverse the existing invoice
      await reverseSalesInvoice(
        existingInvoice._id,
        transaction_type + " Sales"
      );
      // existingInvoice.status = transaction_type;

      //await existingInvoice.save();

      // Return success response
      res.status(200).json({
        message: "Invoice return successfully",
        invoice: existingInvoice,
      });
    }
  } catch (error) {
    console.error("Error during invoice update:", error.message);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// Process payment for a sales invoice
exports.processPayment = async (req, res) => {
  const { id } = req.params;
  const { paymentDetails } = req.body;

  try {
    await processPayment(id, paymentDetails);
    res.json({ message: "Payment processed successfully" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteInvoice = async (req, res) => {
  const { id } = req.params;

  console.log(`Request received to delete invoice with ID: ${id}`);

  try {
    // Step 1: Find the existing invoice
    const existingInvoice = await SalesInvoice.findById(id)
      .populate("customer")
      .populate("items.item_id");

    if (!existingInvoice) {
      console.log("Invoice not found in the database.");
      return res.status(404).json({ message: "Invoice not found" });
    }

    console.log("Existing invoice found:", existingInvoice);

    // Step 2: Reverse all associated transactions
    console.log("Reversing all transactions associated with the invoice...");
    await reverseSalesInvoice(existingInvoice._id, "during Delete the sale");

    // Step 3: Delete the invoice
    console.log("Deleting the invoice...");
    if (existingInvoice?.ticketId) {
      console.log("ticketId found ", existingInvoice?.ticketId);
      const ticket = await Ticket.findById(existingInvoice.ticketId);
      ticket.invoiceId = null;
      existingInvoice.ticketId = null;
      await ticket.save();
      console.log("Deleting the invoice id from  ticket...");
    }
    // Update invoice status
    existingInvoice.status = "Reversed";
    existingInvoice.transaction_type = "Reversed";
    await existingInvoice.save();
    // Step 4: Return success response
    console.log("Invoice deleted successfully.");
    res.status(200).json({
      message:
        "Invoice and associated transactions reversed and deleted successfully",
    });
  } catch (error) {
    console.error("Error during invoice deletion:", error.message);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

//invoiceId - _id
async function reverseSalesInvoice(invoiceId, action) {
  try {
    console.log("reverseSalesInvoice() started \n\n");
    const invoice = await SalesInvoice.findById(invoiceId);
    if (!invoice) throw new Error("Invoice not found");

    // Revert payment
    await processPaymentReversal(invoiceId, action);

    // Revert inventory
    await updateInventoryReversal(invoice.items);

    // Remove sales items from shift
    await logSaleInShiftReversal(
      invoice.shift_id,
      invoice.invoice_id,
      invoice.total_amount
    );

    // Update invoice status
    invoice.status = "Reversed";
    invoice.transaction_type = "Reversed";
    await invoice.save();

    // Void linked warranty records
    try {
      await warrantyController.voidWarrantiesForInvoice(invoice._id);
    } catch (wErr) {
      console.error("Error voiding warranties:", wErr);
    }

    // Remove payment records
    await Payment.deleteMany({ references: { sale: invoiceId } });

    // Remove transaction records
    //await Transaction.deleteMany({ reason: `Payment for Invoice ${invoiceId}` });
  } catch (error) {
    console.error("Error during invoice reversal:", error.message);
    throw error;
  }
}

async function processPaymentReversal(
  invoiceId,
  action = "during adjust Sale"
) {
  try {
    // Fetch the invoice
    const invoice = await SalesInvoice.findById(invoiceId);
    if (!invoice) {
      throw new Error("Invoice not found");
    }

    // Fetch the company and customer accounts
    const companyAccount = await Account.findOne({
      account_owner_type: "Company",
    });
    const customerAccount = await Account.findOne({
      related_party_id: invoice.customer,
      account_owner_type: "Customer",
    });

    if (!companyAccount || !customerAccount) {
      throw new Error("Company or Customer account not found");
    }

    // Fetch all transactions related to the invoice
    const transactions = await Transaction.find({
      reason: { $regex: `${invoice.invoice_id}`, $options: "i" },
    });

    // Process each transaction
    for (const transaction of transactions) {
      // Check if the transaction is for a credit sale
      const isCreditSale = transaction.reason.toLowerCase().includes("credit");

      if (isCreditSale) {
        // If it's a credit sale, just delete the transaction
        console.log(
          `Deleted credit sale transaction: ${transaction._id} (Reason: ${transaction.reason})`
        );
        await transaction.deleteOne();
      } else {
        // If it's not a credit sale (e.g., cash, bank, cheque), process the refund

        // Deduct from company account and add to customer account
        companyAccount.balance -= transaction.amount;
        customerAccount.balance += transaction.amount;
        await companyAccount.save();
        await customerAccount.save();

        // Create a new transaction for the company account (deduction)
        const companyRefundTransaction = new Transaction({
          account_id: companyAccount._id, // Refund is recorded in the company account
          amount: transaction.amount,
          transaction_type: "Withdrawal", // Refund is a withdrawal from the company account
          reason: `Refund for Invoice ${invoice.invoice_id} ${action}`, // Valid reason for the refund
          transaction_date: new Date(),
          balance_after_transaction: companyAccount.balance, // Updated company balance
        });

        await companyRefundTransaction.save();

        // Create a new transaction for the customer account (refund received)
        const customerRefundTransaction = new Transaction({
          account_id: customerAccount._id, // Refund is recorded in the customer account
          amount: transaction.amount,
          transaction_type: "Deposit", // Refund is a deposit to the customer account
          reason: `Refund received for Invoice ${invoice.invoice_id} ${action}`, // Valid reason for the refund
          transaction_date: new Date(),
          balance_after_transaction: customerAccount.balance, // Updated customer balance
        });
        await customerRefundTransaction.save();

        console.log(
          `Refunded ${transaction.amount} for transaction: ${transaction._id} (Reason: ${transaction.reason})`
        );

        // Delete the original transaction
        //await transaction.deleteOne();
      }
    }

    // Delete payment records associated with the invoice
    await Payment.deleteMany({ references: { sale: invoice._id } });

    console.log(
      `Payment reversal completed for invoice: ${invoice.invoice_id}`
    );
  } catch (error) {
    console.error("Error during payment reversal:", error);
    throw error;
  }
}

// End of file

async function logSaleInShiftReversal(shiftId, invoiceId, total_amount) {
  try {
    const shift = await Shift.findById(shiftId);
    if (!shift) throw new Error("Shift not found");

    // Remove sales item from shift
    shift.sales = shift.sales.filter((sale) => sale !== invoiceId);
    shift.totalSales -= total_amount;
    shift.totalTransactions -= 1;
    await shift.save();
  } catch (error) {
    console.error("Error during shift reversal:", error);
    throw error;
  }
}
