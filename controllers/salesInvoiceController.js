const SalesInvoice = require("../models/SalesInvoice");
const Account = require("../models/Account");
const Transaction = require("../models/Transaction");
const SerializedStock = require("../models/SerializedStock");
const NonSerializedStock = require("../models/NonSerializedStock");
const Payment = require("../models/Payment");
const Shift = require("../models/Shift");
const { ApiError } = require("../utility/ApiError");
const Ticket = require("../models/Ticket");

async function updateInventory_old(items) {
  console.log("updateInventory start...");
  const serializedItems = items.filter((item) => item.isSerialized);
  const nonSerializedItems = items.filter((item) => !item.isSerialized);

  // Update serialized items in bulk
  
  const serializedUpdates = [];
      
  for (const item of serializedItems) {
    // Validate serial numbers
    if (!Array.isArray(item.serialNumbers)) {
      throw new ApiError(400, 'Invalid serial numbers format');
    }

    // Create individual updates for each serial number
    item.serialNumbers.forEach(serialNumber => {
      serializedUpdates.push({
        updateOne: {
          filter: { serialNumber: serialNumber },
          update: { 
            $set: { 
              status: "Sold", 
              sold_date: new Date()  
            }
          }
        }
      });
    });
  }

 
  // Update non-serialized items in bulk
  const nonSerializedUpdates = nonSerializedItems.map((item) => ({
    updateOne: {
      filter: { item_id: item.item_id },
      update: {
        $inc: {
          soldQty: item.quantity,
          availableQty: -item.quantity,
        },
      },
    },
  }));

  await Promise.all([
    await SerializedStock.bulkWrite(serializedUpdates),
    await NonSerializedStock.bulkWrite(nonSerializedUpdates),
  ]);

  console.log("updateInventory end...");
}

async function updateInventory(items) {
  try {
    console.log("updateInventory start...");

    // Separate serialized and non-serialized items
    const { serializedItems, nonSerializedItems } = separateItems(items);

    // Validate and prepare serialized items for bulk update
    const serializedUpdates = prepareSerializedUpdates(serializedItems);

    // Prepare non-serialized items for bulk update
    const nonSerializedUpdates = prepareNonSerializedUpdates(nonSerializedItems);

    // Perform bulk updates
    await performBulkUpdates(serializedUpdates, nonSerializedUpdates);

    console.log("updateInventory end...");
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// Helper function to separate serialized and non-serialized items
function separateItems(items) {
  return {
    serializedItems: items.filter((item) => item.isSerialized),
    nonSerializedItems: items.filter((item) => !item.isSerialized),
  };
}

// Helper function to prepare serialized items for bulk update
function prepareSerializedUpdates(serializedItems) {
  return serializedItems.flatMap((item) => {
    if (!Array.isArray(item.serialNumbers)) {
      throw new ApiError(400, 'Invalid serial numbers format');
    }
    return item.serialNumbers.map((serialNumber) => ({
      updateOne: {
        filter: { serialNumber },
        update: {
          $set: {
            status: "Sold",
            sold_date: new Date(),
          },
        },
      },
    }));
  });
}

// Helper function to prepare non-serialized items for bulk update
function prepareNonSerializedUpdates(nonSerializedItems) {
  return nonSerializedItems.map((item) => ({
    updateOne: {
      filter: { item_id: item.item_id },
      update: {
        $inc: {
          soldQty: item.quantity,
          availableQty: -item.quantity,
        },
      },
    },
  }));
}

// Helper function to perform bulk updates
async function performBulkUpdates(serializedUpdates, nonSerializedUpdates) {
  await Promise.all([
    SerializedStock.bulkWrite(serializedUpdates),
    NonSerializedStock.bulkWrite(nonSerializedUpdates),
  ]);
}


async function processPayment(invoiceId, paymentDetails) {
  console.log("processPayment start...");

  const invoice = await SalesInvoice.findOne({
    invoice_id: invoiceId,
  });

  if (!invoice) throw new Error("Invoice not found");

  let totalPaid = 0;
  let totalAmount = 0;
  let balance = 0;
  let isPaid = false;

  // Get the company account
  const companyAccount = await Account.findOne({
    account_owner_type: "Company",
  });

  if (!companyAccount) throw new Error("Company account not found");

  const customerAccount = await Account.findOne({
    account_owner_type: "Customer",
    related_party_id: invoice.customer,
  });

  if (!customerAccount) throw new Error("Company account not found");

  for (const payment of paymentDetails) {
    const { method, amount } = payment;
    console.log("paid amount : ", amount);
    if (amount && amount > 0) {
      //amount =10000 / 1000*10
      //totalSales = 2500
      //overpaid = 7500
      totalAmount += amount;
      console.log("totalAmount : ", totalAmount);

      if (invoice.total_amount <= totalAmount && !isPaid) {
        //add extra amount to deposit to customer account

        // add a payment to company
        balance = totalAmount - invoice.total_amount;
        const needpaid = totalAmount - balance;

        const transaction = new Transaction({
          account_id: companyAccount._id,
          amount: needpaid,
          transaction_type: "Deposit",
          reason: `Payment for Invoice ${invoice.invoice_id} via ${method}`,
          balance_after_transaction: companyAccount.balance + needpaid,
        });
        await transaction.save();

        // Update company account balance
        companyAccount.balance += needpaid;
        await companyAccount.save();

        // Create a payment record
        const paymentRecord = new Payment({
          from_account_id: invoice.customer, // Assuming the customer account is the source
          to_account_id: companyAccount._id, // Company account is the destination
          amount: needpaid,
          payment_methods: [{ method: method, amount: needpaid }],
          transaction_type: "Sale", // Adjust as necessary
          references: {
            customer: invoice.customer,
            sale: invoice._id,
          },
          description: `Payment for Invoice ${invoice.invoice_id}`,
        });

        await paymentRecord.save();

        if (balance !== 0) {
          //add extra balance to customer acount
          const transaction = new Transaction({
            account_id: customerAccount._id,
            amount: balance,
            transaction_type: "Deposit",
            reason: `Extra Payment from Invoice ${invoice.invoice_id} via ${method}`,
            balance_after_transaction: customerAccount.balance + balance,
          });

          await transaction.save();

          // Update customer account balance
          customerAccount.balance += balance;
          await customerAccount.save();
        }

        totalPaid += needpaid;
        isPaid = balance !== 0;
      } else if (isPaid && balance !== 0) {
        //extra rest amount to pay
        //add extra balance to customer acount
        const transaction = new Transaction({
          account_id: customerAccount._id,
          amount: balance,
          transaction_type: "Deposit",
          reason: `Extra Payment from Invoice ${invoice.invoice_id} via ${method}`,
          balance_after_transaction: customerAccount.balance + balance,
        });

        await transaction.save();

        // Update customer account balance
        customerAccount.balance += balance;
        await customerAccount.save();
      } else if (invoice.total_amount >= totalAmount && !isPaid) {
        const transaction = new Transaction({
          account_id: companyAccount._id,
          amount: amount,
          transaction_type: "Deposit",
          reason: `Partial Payment for Invoice ${invoice.invoice_id} via ${method}`,
          balance_after_transaction: companyAccount.balance + amount,
        });
        await transaction.save();

        // Update company account balance
        companyAccount.balance += amount;
        await companyAccount.save();

        // Create a payment record
        const paymentRecord = new Payment({
          from_account_id: invoice.customer, // Assuming the customer account is the source
          to_account_id: companyAccount._id, // Company account is the destination
          amount: amount,
          payment_methods: [{ method: method, amount: amount }],
          transaction_type: "Sale", // Adjust as necessary
          references: {
            customer: invoice.customer,
            sale: invoice._id,
          },
          description: `Partial Payment for Invoice ${invoice.invoice_id}`,
        });

        await paymentRecord.save();

        totalPaid += amount;
      }
    }
  }

  const invoiceStatus =
    invoice.total_paid_amount === 0
      ? "Unpaid"
      : invoice.total_amount === invoice.total_paid_amount
      ? "Paid"
      : "Partially paid";
  // Update the invoice due amount
  //invoice.total_paid_amount = totalPaid;
  invoice.status = invoiceStatus;
  console.log("invoice.status ", invoice.status);
  if (invoiceStatus === "Partially paid" || invoiceStatus === "Unpaid") {
    // update balance as a Due for customer account
    const dueAmount = invoice.total_amount - invoice.total_paid_amount;
    await handleCreditSale(invoice.customer, dueAmount, invoice.invoice_id);
  }

  await Promise.all([await invoice.save()]);

  console.log("processPayment end...");
}

async function handleCreditSale(customerId, totalAmount, invoice_id) {
  // Update customer account with due amount
  console.log("handleCreditSale start...");
  console.log("handleCreditSale start...", totalAmount);
  const method = "Cash";

  const invoice = await SalesInvoice.findOne({
    invoice_id: invoice_id,
  });
  if (!invoice) throw new Error("Invoice not found");

  const customerAccount = await Account.findOne({
    related_party_id: customerId,
    account_owner_type: "Customer",
  });
  if (!customerAccount) throw new Error("Customer account not found");

  if (customerAccount.balance >= totalAmount) {
    //customer has balance in his/her account
    //deduct from customer account

    // Get the company account
    const companyAccount = await Account.findOne({
      account_owner_type: "Company",
    });

    if (!companyAccount) throw new Error("Company account not found");

    //deposit to company

    const transaction = new Transaction({
      account_id: companyAccount._id,
      amount: totalAmount,
      transaction_type: "Deposit",
      reason: `Payment Recover from Customer Account for Invoice ${invoice.invoice_id} via ${method}`,
      balance_after_transaction: companyAccount.balance + totalAmount,
    });
    await transaction.save();

    // Update company account balance
    companyAccount.balance += totalAmount;
    await companyAccount.save();

    // Create a payment record
    const paymentRecord = new Payment({
      from_account_id: invoice.customer, // Assuming the customer account is the source
      to_account_id: companyAccount._id, // Company account is the destination
      amount: totalAmount,
      payment_methods: [{ method: "Cash", amount: totalAmount }],
      transaction_type: "Sale", // Adjust as necessary
      references: {
        customer: invoice.customer,
        sale: invoice._id,
      },
      description: `Payment Recover from Customer Account for Invoice ${invoice.invoice_id}`,
    });

    //update invoice status to paid
    invoice.status = "Paid";
    invoice.total_paid_amount = invoice.total_amount;

    invoice.payment_methods = [
      {
        method: "Account",
        amount: invoice.total_amount, // Amount paid via this method
        details: {
          account_number: customerAccount._id,
        },
      },
    ];

    console.log("new invoice.status ", invoice.payment_methods);
    await Promise.all([await paymentRecord.save(), await invoice.save()]);

    //withdrawal from customer
    const customer_transaction = new Transaction({
      account_id: customerAccount._id,
      amount: totalAmount,
      transaction_type: "Withdrawal",
      reason: `Auto Payment Deduct for Credit Sale Invoice  ${invoice_id} from Account`,
      balance_after_transaction: customerAccount.balance - totalAmount,
    });

    await customer_transaction.save();

    // Update customer account balance
    customerAccount.balance -= totalAmount;
    await customerAccount.save();
  } else {
    // Create a transaction for the due amount
    const transaction = new Transaction({
      account_id: customerAccount._id,
      amount: totalAmount,
      transaction_type: "Withdrawal",
      reason: `Credit Sale Invoice Created ${invoice_id}`,
      balance_after_transaction: customerAccount.balance - totalAmount,
    });

    await transaction.save();

    // Update customer account balance
    customerAccount.balance -= totalAmount;
    await customerAccount.save();
  }
  console.log({ customerAccount });
  console.log("handleCreditSale end...");
}

async function paymentProcessFromAccount(customerId, totalAmount, invoice_id) {
  console.log("paymentProcessFromAccount start...");
  const invoice = await SalesInvoice.findOne({
    invoice_id: invoice_id,
  });
  if (!invoice) throw new Error("Invoice not found");

  const companyAccount = await Account.findOne({
    account_owner_type: "Company",
  });
  if (!companyAccount) throw new Error("companyAccount account not found");

  const customerAccount = await Account.findOne({
    related_party_id: customerId,
    account_owner_type: "Customer",
  });
  if (!customerAccount) throw new Error("Customer account not found");

  if (customerAccount.balance >= totalAmount) {
    //customer has balance in his/her account
    //deduct from customer account

    // Get the company account
    const companyAccount = await Account.findOne({
      account_owner_type: "Company",
    });

    if (!companyAccount) throw new Error("Company account not found");

    //deposit to company

    const transaction = new Transaction({
      account_id: companyAccount._id,
      amount: totalAmount,
      transaction_type: "Deposit",
      reason: `Payment Recover from Customer Account for Invoice ${invoice.invoice_id} via ${method}`,
      balance_after_transaction: companyAccount.balance + totalAmount,
    });
    await transaction.save();

    // Update company account balance
    companyAccount.balance += totalAmount;
    await companyAccount.save();

    // Create a payment record
    const paymentRecord = new Payment({
      from_account_id: invoice.customer, // Assuming the customer account is the source
      to_account_id: companyAccount._id, // Company account is the destination
      amount: totalAmount,
      payment_methods: [{ method: "Cash", amount: totalAmount }],
      transaction_type: "Sale", // Adjust as necessary
      references: {
        customer: invoice.customer,
        sale: invoice._id,
      },
      description: `Payment Recover from Customer Account for Invoice ${invoice.invoice_id}`,
    });

    //update invoice status to paid
    invoice.status = "Paid";
    invoice.total_paid_amount = invoice.total_amount;

    invoice.payment_methods = [
      {
        method: "Account",
        amount: invoice.total_amount, // Amount paid via this method
        details: {
          account_number: customerAccount._id,
        },
      },
    ];

    console.log("new invoice.status ", invoice.payment_methods);
    await Promise.all([await paymentRecord.save(), await invoice.save()]);

    //withdrawal from customer
    const customer_transaction = new Transaction({
      account_id: customerAccount._id,
      amount: totalAmount,
      transaction_type: "Withdrawal",
      reason: `Auto Payment Deduct for Credit Sale Invoice  ${invoice_id} from Account`,
      balance_after_transaction: customerAccount.balance - totalAmount,
    });

    await customer_transaction.save();

    // Update customer account balance
    customerAccount.balance -= totalAmount;
    await customerAccount.save();
  } else {
    if (customerAccount.balance > 0 && customerAccount.balance <= totalAmount) {
      // Create a transaction for the due amount
      const transaction = new Transaction({
        account_id: customerAccount._id,
        amount: totalAmount - customerAccount.balance,
        transaction_type: "Withdrawal",
        reason: `Credit Sale Invoice Created ${invoice_id}`,
        balance_after_transaction: customerAccount.balance - totalAmount,
      });

      await transaction.save();

      // Update customer account balance
      customerAccount.balance -= totalAmount;
      await customerAccount.save();

      // re-pay for company

      const companytransaction = new Transaction({
        account_id: companyAccount._id,
        amount: customerAccount.balance,
        transaction_type: "Deposit",
        reason: `Payment re-transfer from customer account to company account, for this invoice  ${invoice_id}`,
        balance_after_transaction: companyAccount.balance - customerAccount.balance,
      });

      await companytransaction.save();

      // Update customer account balance
      companyAccount.balance -= totalAmount;
      await companyAccount.save();
    } else {
      // Create a transaction for the due amount
      const transaction = new Transaction({
        account_id: customerAccount._id,
        amount: totalAmount,
        transaction_type: "Withdrawal",
        reason: `Credit Sale Invoice Created ${invoice_id}`,
        balance_after_transaction: customerAccount.balance - totalAmount,
      });

      await transaction.save();

      // Update customer account balance
      customerAccount.balance -= totalAmount;
      await customerAccount.save();
    }
  }
}

async function logSaleInShift(shiftId, invoiceId, totalAmount) {
  // Find the shift by ID
  const shift = await Shift.findById(shiftId);
  if (!shift) throw new Error("Shift not found");

  // Update the shift's total sales and transaction count
  shift.totalSales += totalAmount; // Increment total sales
  shift.totalTransactions += 1; // Increment total transactions
  shift.sales.push(invoiceId); // Assuming you have a sales array in the Shift schema

  // Save the updated shift
  await shift.save();
}

async function createSalesInvoice(
  customerId,
  items,
  payment_methods=[],
  transactionType,
  userId,
  shiftId,
  notes,
  invoice_type,
  serviceItems,
  ticketId
) {
  const itemTotal = items.reduce((total, item) => total + item.totalPrice, 0);
  const serviceTotal = serviceItems && serviceItems.reduce((total, item) => total + item.total, 0);
  const total_paid_amount = payment_methods.reduce(
    (total, item) => total + item.amount,
    0
  );

  const totalAmount = itemTotal+serviceTotal
  // Create the sales invoice
  const invoice = new SalesInvoice({
    customer: customerId,
    items,
    total_amount: itemTotal+serviceTotal,
    total_paid_amount,
    payment_methods: payment_methods,
    transaction_type: transactionType,
    user_id: userId,
    shift_id: shiftId,
    notes,

    invoice_type,
    serviceItems,
    ticketId
  });

  if(invoice_type ==="Service"){

    const ticket = await Ticket.findById(ticketId)
    if(!ticket) throw Error("Ticket not found")
    
    ticket.invoiceId = invoice._id
    await ticket.save()
    invoice.ticketId = ticket._id
  }

  await invoice.save();

  // Handle payments sales
  // await handleCashSale(totalAmount, invoice.invoice_id, paymentMethods);
  await processPayment(invoice.invoice_id, payment_methods);

  // Update inventory
  await updateInventory(items);

  // Update Sales shift
  await logSaleInShift(shiftId, invoice.invoice_id, totalAmount);

  
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
    console.log('createReversalSalesInvoice() started...\n')
    console.log('#######################\n')
      console.log( "invoice_type",invoice_type)
      console.log("serviceItems", serviceItems)
        console.log("ticketId",ticketId)
        
        console.log('#######################\n')
    const itemTotal = items.reduce((total, item) => total + item.totalPrice, 0);
    const serviceItemsArray = Array.isArray(serviceItems) ? serviceItems : [];
    const serviceTotal = serviceItemsArray.reduce((total, item) => total + item.total, 0);
    //const serviceTotal = serviceItems && serviceItems.reduce((total, item) => total + item.total, 0);
    const totalAmount = itemTotal+serviceTotal
    const total_paid_amount = paymentMethods.reduce(
      (total, item) => total + item.amount,
      0
    );
  
  
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
      ticketId
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
  
    return lastInvoice;
    console.log('createReversalSalesInvoice() ended...\n')
  }
  catch (error) {
  // Handle errors
  console.log('createReversalSalesInvoice() failed', error);
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
    // Validate input data
    if (!existingInvoice || !updates) {
      throw new Error("Invalid input data");
    }

    // Check if company account exists
    const companyAccount = await Account.findOne({ account_owner_type: "Company" });
    if (!companyAccount) {
      throw new Error("Company account not found");
    }

    // Calculate settlement amount
    const settlementAmount = updates.total_paid_amount - existingInvoice.total_paid_amount;

    // Get new payment methods
    const newPaymentMethods = updates.payment_methods.filter(
      (newMethod) =>
        !existingInvoice.payment_methods.some(
          (existingMethod) =>
            existingMethod.method === newMethod.method && existingMethod.amount === newMethod.amount
        )
    );

    // Loop through new payment methods and settle due
    for (const payment of newPaymentMethods) {
      const { method, amount } = payment;

      // Calculate the payment amount to apply
      const paymentAmountToApply = Math.min(amount, settlementAmount);

      // Create a new transaction
      const transaction = new Transaction({
        account_id: companyAccount._id,
        amount: paymentAmountToApply,
        transaction_type: "Deposit",
        reason: `Due Payment Settled for Invoice ${existingInvoice.invoice_id} via ${method}`,
        description: `Settling due payment of ${paymentAmountToApply} for invoice ${existingInvoice.invoice_id} using ${method}`,
        balance_after_transaction: companyAccount.balance + paymentAmountToApply,
      });
      await transaction.save();

      // Update company account balance
      companyAccount.balance += paymentAmountToApply;
      await companyAccount.save();

      // Update invoice status
      existingInvoice.status = settlementAmount+existingInvoice.total_paid_amount  >= existingInvoice.total_amount ? "Paid" : "Partially paid";
      existingInvoice.total_paid_amount += paymentAmountToApply;
      await existingInvoice.save();
    
   

      // Log settlement process
      console.log(`Due payment settled for invoice ${existingInvoice.invoice_id} using ${method}`);
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

// Create a new sales invoice
exports.createSalesInvoice = async (req, res) => {
  const {
    customer,
    items,
    payment_methods,
    transaction_type,
    user_id,
    shift_id,
    notes="",


    invoice_type="Sale",
serviceItems=[],
ticketId=""
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
      ticketId
    );
    res.status(201).json(invoice);
  } catch (error) {
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
    const limit = req.query.limit || 10;
    const skip = req.query.skip || 0;
    const sort = req.query.sort || "desc"; // default to descending order

    const invoices = await SalesInvoice.find()
      .populate("customer")
      .populate("ticketId")
      .populate("ticketId")
      .populate("items.item_id")
      .sort({ invoice_date: sort }) // sort by createdAt field
      //.limit(limit)
      .skip(skip);

    return res.status(200).json(invoices);
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
    notes="",
  ticketId
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

    console.log("Existing invoice found:", existingInvoice);

    if(existingInvoice.status ==="Reversed"){
      return res.status(404).json({ message: "Invoice already Reversed, Cannot modify again" });
    }

    const oldDue = existingInvoice.total_amount - existingInvoice.total_paid_amount;
    const updatedDue = updates.total_amount - updates.total_paid_amount;
  
    if (oldDue > updatedDue) {
     
    const result = await settleDuePayment(existingInvoice, updates);
    return res.status(200).json(result);
    }

 // Step 2: Identify transaction_type
    if(transaction_type === "Sale"){

      const hasCustomerChange =
      updates.customer &&
      updates.customer.toString() !==
        existingInvoice.customer.customer_id.toString();
    const hasItemChanges =
      updates.items &&
      JSON.stringify(updates.items) !== JSON.stringify(existingInvoice.items);

    console.log("Has customer change?", hasCustomerChange);
    console.log("Has item changes?", hasItemChanges);

    if (hasCustomerChange || hasItemChanges) {
      console.log(
        "Financial changes detected. Reversing and re-entering invoice."
      );

      // Step 3a: Reverse the existing invoice
      await reverseSalesInvoice(existingInvoice._id, "Updating Sales");
console.log('reverseSalesInvoice compledted...\n')
console.log('create a new sales invoice started ...\n')
      const newInvoice = await createReversalSalesInvoice(
        customer,
        items,
        payment_methods,
        transaction_type,
        user_id,
        shift_id,
        notes,
        req.body.invoice_type,
        req.body.serviceItems,
        req.body.ticketId
      );
      console.log('create a new sales invoice ended ...\n')
      console.log("New invoice created:", newInvoice);

       // Return success response
       res.status(200).json({
        message: "Invoice reversed and re-entered successfully",
        invoice: newInvoice,
      });


    }   else {
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
  }
    else{
      // reversed only

      // Step 3a: Reverse the existing invoice
      await reverseSalesInvoice(existingInvoice._id, transaction_type+" Sales");
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
    if(existingInvoice?.ticketId){
      console.log('ticketId found ', existingInvoice?.ticketId)
     const ticket = await Ticket.findById(existingInvoice.ticketId);
     ticket.invoiceId = null;
     existingInvoice.ticketId = null
     await ticket.save()
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
    console.log('reverseSalesInvoice() started \n\n')
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

async function updateInventoryReversal(items) {
  try {
    console.log('updateInventoryReversal() started ....\n')
    const serializedItems = items.filter((item) => item.isSerialized);
    const nonSerializedItems = items.filter((item) => !item.isSerialized);

    // Revert serialized items
    const serializedUpdates = serializedItems.map((item) => ({
      updateOne: {
        filter: { serialNumber: { $in: item.serialNumbers } },
        update: { $set: { status: "Available", sold_date: null } },
      },
    }));
    await SerializedStock.bulkWrite(serializedUpdates);

    // Revert non-serialized items
    const nonSerializedUpdates = nonSerializedItems.map((item) => ({
      updateOne: {
        filter: { item_id: item.item_id },
        update: {
          $inc: {
            soldQty: -item.quantity,
            availableQty: item.quantity,
            /**
             *
             * In MongoDB, when using the $inc operator, you don't need to specify the plus sign (+) explicitly. The value you provide will be added to the existing value.
             */
          },
        },
      },
    }));
    await NonSerializedStock.bulkWrite(nonSerializedUpdates);
    console.log('updateInventoryReversal() ended ....\n')
  } catch (error) {
    console.error("Error during inventory reversal:", error);
    throw error;
  }
}

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
