const mongoose = require('mongoose');
const Shift = require('../models/Shift');
const User = require('../models/User');
const SalesInvoice = require('../models/SalesInvoice');
const Employees = require('../models/Employee');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');

exports.createShift = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    let { userId, startCash, accountId, sourceAccountId, useExistingBalance } = req.body;

    // --- INPUT SANITIZATION ---
    // Mongoose throws 'CastError' if we send "" to an ObjectId field. 
    // We convert "" to null to satisfy the schema.
    if (accountId === "") accountId = null;
    if (sourceAccountId === "") sourceAccountId = null;

    if (!accountId) {
      throw new Error("Cash Drawer/Account is required");
    }

    // 0. Worker Lock: Prevent one user from opening multiple shifts
    const existingActiveShift = await Shift.findOne({ userId, status: 'active' }).session(session);
    if (existingActiveShift) {
      throw new Error("Worker Lock: You already have an active session! Double-check your workstation.");
    }

    // 1. Fetch Drawer Account
    const drawerAccount = await Account.findById(accountId).session(session);
    if (!drawerAccount) throw new Error("Cash Drawer account not found");

    // Collision Guard: Prevent overlapping shifts on one account
    if (drawerAccount.activeShiftId) {
      throw new Error("Collision Guard: This account is already linked to an active session.");
    }

    const physicalCash = Number(startCash);
    let ledgerBeforeTransfer = drawerAccount.balance || 0;

    // 2. Handle Float Source (Vault to Drawer Transfer)
    if (!useExistingBalance && sourceAccountId) {
      const vaultAccount = await Account.findById(sourceAccountId).session(session);
      if (!vaultAccount) throw new Error("Source Vault account not found");

      if (vaultAccount.balance < physicalCash) {
        throw new Error(`Insufficient funds in Vault! Available: Rs. ${vaultAccount.balance}`);
      }

      // A. Debit Vault
      vaultAccount.balance -= physicalCash;
      await vaultAccount.save({ session });

      // B. Credit Drawer
      drawerAccount.balance += physicalCash;
      await drawerAccount.save({ session });

      // C. Record Transfer Transaction
      const vaultTx = new Transaction({
        account_id: vaultAccount._id,
        amount: physicalCash,
        transaction_type: "Withdrawal",
        reason: `Float Transfer to ${drawerAccount.account_name}`,
        balance_after_transaction: vaultAccount.balance
      });
      await vaultTx.save({ session });

      ledgerBeforeTransfer = drawerAccount.balance; // Balance should now be 'ledger + physical'
    }

    // 3. Validate Opening Balance (Audit Point)
    const openingDiscrepancy = physicalCash - ledgerBeforeTransfer;

    // 4. Force Ledger to match Reality
    if (openingDiscrepancy !== 0) {
      drawerAccount.balance = physicalCash;
      await drawerAccount.save({ session });

      const reconcileTx = new Transaction({
        account_id: drawerAccount._id,
        amount: Math.abs(openingDiscrepancy),
        transaction_type: openingDiscrepancy > 0 ? "Deposit" : "Withdrawal",
        reason: `Opening Reconciliation (Mismatch detected at Handover)`,
        balance_after_transaction: physicalCash
      });
      await reconcileTx.save({ session });
    }

    // 5. Create Shift Record
    const newShift = new Shift({
      ...req.body,
      accountId,       // Explicitly use sanitized null instead of ""
      sourceAccountId, // Explicitly use sanitized null instead of ""
      openingMismatch: openingDiscrepancy,
      status: 'active'
    });
    await newShift.save({ session });

    // Link Account to this Shift (Locking)
    drawerAccount.activeShiftId = newShift._id;
    await drawerAccount.save({ session });

    // 6. Log Discrepancy (Now with valid Shift ID reference)
    if (openingDiscrepancy !== 0) {
      const DiscrepancyLog = require("../models/DiscrepancyLog");
      await DiscrepancyLog.create([{
        type: "Cash",
        category: openingDiscrepancy < 0 ? "Opening Shortage" : "Opening Excess",
        reference_id: newShift._id,
        field_name: "opening_cash",
        expected_value: ledgerBeforeTransfer,
        actual_value: physicalCash,
        delta: openingDiscrepancy,
        reason: `Handover Variance acknowledged by operator`,
        user_id: userId
      }], { session });
    }

    await session.commitTransaction();

    // Final population for UI
    const populatedShift = await Shift.findById(newShift._id).populate('accountId', 'account_name balance');
    res.status(201).json(populatedShift);
  } catch (error) {
    await session.abortTransaction();
    console.error("Atomic Shift Creation Failed:", error);
    res.status(400).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

exports.closeShift = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { actualCash, breakdownActuals, notes } = req.body;
    const shift = await Shift.findById(req.params.id).session(session);
    if (!shift) throw new Error('Shift not found');
    if (shift.status === 'closed') throw new Error('Terminal already decommissioned');

    if (actualCash === undefined || actualCash === null) {
      throw new Error('Physical cash count is required to close shift');
    }

    // 1. Reconcile all payments from invoices
    const salesInvoices = await SalesInvoice.find({ invoice_id: { $in: shift.sales } }).session(session);

    const totals = { "Account": 0, "Cash": 0, "Card": 0, "Cheque": 0, "Bank Transfer": 0 };
    salesInvoices.forEach(inv => {
      inv.payment_methods.forEach(pm => {
        if (totals.hasOwnProperty(pm.method)) totals[pm.method] += pm.amount;
      });
    });

    // 2. Map totals and Snapshot (Hard Cutoff)
    const breakdown = Object.keys(totals).map(method => {
      const expected = totals[method];
      const actual = method === "Cash" ? actualCash : (breakdownActuals?.[method] || expected);
      return { method, expected, actual, mismatch: actual - expected };
    });

    const calculated = shift.calculatedEndCash;
    const discrepancy = actualCash - calculated;

    shift.finalCalculatedCash = calculated;
    shift.finalTotalSales = Object.values(totals).reduce((a, b) => a + b, 0);
    shift.finalPaymentBreakdown = breakdown;
    shift.paymentBreakdown = breakdown;
    shift.totalCashSales = totals["Cash"];
    shift.totalSales = shift.finalTotalSales;
    shift.actualCash = actualCash;
    shift.mismatch = discrepancy;
    shift.isClosed = true;
    shift.status = 'closed';
    shift.endTime = new Date();
    shift.notes = notes;

    await shift.save({ session });

    // 3. Ledger Reconciliation & Lock Release
    if (shift.accountId) {
      const account = await Account.findById(shift.accountId).session(session);
      if (account) {
        // Force Ledger to match Reality
        account.balance = actualCash;
        account.activeShiftId = null; // RELEASE THE COLLISION LOCK
        await account.save({ session });

        if (discrepancy !== 0) {
          const reconTransaction = new Transaction({
            account_id: account._id,
            amount: Math.abs(discrepancy),
            transaction_type: discrepancy < 0 ? "Withdrawal" : "Deposit",
            reason: `Shift Closure Reconciliation (Audit Variance Recorded)`,
            balance_after_transaction: actualCash
          });
          await reconTransaction.save({ session });
        }
      }
    }

    // 4. Log Formal Discrepancy
    if (discrepancy !== 0) {
      const DiscrepancyLog = require("../models/DiscrepancyLog");
      await DiscrepancyLog.create([{
        type: "Cash",
        category: discrepancy < 0 ? "Shortage" : "Excess",
        reference_id: shift._id,
        field_name: "physical_cash",
        expected_value: calculated,
        actual_value: actualCash,
        delta: discrepancy,
        reason: notes || "Shift Closure Mismatch",
        user_id: req.user?._id || shift.userId
      }], { session });
    }

    await session.commitTransaction();
    res.status(200).json({
      message: discrepancy === 0 ? 'Terminal successfully decommissioned (Balanced)' : 'Terminal decommissioned with audit discrepancy logged',
      shift,
      discrepancy
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Atomic Shift Closure Failed:", error);
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// [NEW] X-Report: Real-time calculation without closure
exports.getXReport = async (req, res) => {
  try {
    const { id } = req.params;
    const shift = await Shift.findById(id);
    if (!shift) return res.status(404).json({ message: "Shift not found" });

    const salesInvoices = await SalesInvoice.find({ invoice_id: { $in: shift.sales } });
    const totals = { "Account": 0, "Cash": 0, "Card": 0, "Cheque": 0, "Bank Transfer": 0 };

    salesInvoices.forEach(inv => {
      inv.payment_methods.forEach(pm => {
        if (totals.hasOwnProperty(pm.method)) totals[pm.method] += pm.amount;
      });
    });

    const calculatedCash = totals["Cash"] + shift.startCash + shift.cashAdded - shift.cashRemoved;

    res.status(200).json({
      shift_id: shift._id,
      operator: shift.userId,
      startTime: shift.startTime,
      totals,
      calculatedCash,
      currentSalesCount: shift.sales.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getShifts = async (req, res) => {
  try {
    const { status, startDate, endDate, userId } = req.query;
    let query = {};

    if (status) query.status = status;
    if (userId) query.userId = userId;

    if (startDate && endDate) {
      query.startTime = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const shifts = await Shift.find(query)
      .populate('userId', 'username employeeId')
      .populate('accountId', 'account_name') // Added population for UI visibility
      .sort({ startTime: -1 });

    res.status(200).json(shifts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.forceEndShift = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const shift = await Shift.findById(id);
    if (!shift) return res.status(404).json({ message: "Shift not found" });
    if (shift.status !== 'active') return res.status(400).json({ message: "Shift is not active" });

    // Admin force close assumes equality or 0 cash if not counted
    // We set actual = calculated to prevent false discrepancies
    const calculated = shift.calculatedEndCash;

    shift.actualCash = calculated;
    shift.mismatch = 0;
    shift.isClosed = true;
    shift.status = 'closed';
    shift.endTime = new Date();
    shift.notes = notes ? `${notes} (Admin Forced Closure)` : "Admin Forced Closure";

    await shift.save();

    res.status(200).json({ message: "Shift force-closed successfully", shift });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.closeAllActiveShifts = async (req, res) => {
  try {
    const { notes } = req.body;
    const activeShifts = await Shift.find({ status: 'active', isClosed: false });

    if (activeShifts.length === 0) {
      return res.status(200).json({ message: "No active shifts to close", count: 0 });
    }

    let closedCount = 0;
    for (const shift of activeShifts) {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        shift.endTime = new Date();
        shift.isClosed = true;
        shift.status = 'closed';

        // Auto-balance logic for bulk decommissioning
        const calculated = (shift.totalCashSales || 0) + shift.startCash + shift.cashAdded - shift.cashRemoved;

        // Populate Snapshots
        shift.finalCalculatedCash = calculated;
        shift.finalTotalSales = shift.totalSales || 0;
        shift.actualCash = calculated;
        shift.mismatch = 0;
        shift.notes = (shift.notes || "") + ` [Admin Bulk Decommission: ${notes || "Global Deactivate Action"}]`;

        await shift.save({ session });

        // Release account lock if linked
        if (shift.accountId) {
          await Account.findByIdAndUpdate(shift.accountId, {
            activeShiftId: null,
            balance: calculated // Balance recon for consistency
          }, { session });
        }

        await session.commitTransaction();
        closedCount++;
      } catch (err) {
        await session.abortTransaction();
        console.error(`Decommission failed for shift ${shift._id}:`, err);
      } finally {
        session.endSession();
      }
    }

    res.status(200).json({
      message: `Successfully decommissioned ${closedCount} active terminals`,
      count: closedCount
    });
  } catch (error) {
    console.error("Error in bulk decommission:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.updateShift = async (req, res) => {
  try {
    const updatedShift = await Shift.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json(updatedShift);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteShift = async (req, res) => {
  try {
    await Shift.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.checkTodayShift = async (req, res) => {
  try {
    const userId = req.params.userId;
    const today = new Date();
    const todayShift = await Shift.findOne({
      userId: userId,
      status: 'active'
    });
    //.populate("userId");

    res.status(200).json(todayShift !== null);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};


exports.getCurrentShift = async (req, res) => {
  try {
    const userId = req.params.userId;
    const currentShift = await Shift.findOne({
      userId: userId,
      status: 'active',
    }).sort({ startTime: -1 }).populate('accountId', 'account_name balance');

    // console.log("current shift ", currentShift)
    if (currentShift) {
      const user = await User.findById(userId);

      if (!user) return res.status(404).json({ error: 'No active shift found' });
      const employee = await Employees.findById(user.employeeId);

      let result = {
        ...currentShift.toObject(),
        user,
        employee,
        calculatedEndCash: currentShift.calculatedEndCash
      };

      if (currentShift.sales && currentShift.sales.length > 0) {
        // Optimization: Lean fetch (no items population) for header/dashboard performance
        const sales = await SalesInvoice.find({ invoice_id: { $in: currentShift.sales } })
          .select("invoice_id total_amount total_paid_amount status payment_methods invoice_date")
          .populate("customer", "name customer_id");
        result.sales = sales;
      }


      return res.status(200).json(result);
    } else {
      return res.status(200).json(null);
    }
  } catch (error) {
    console.error('Error getting current shift:', error);
    return res.status(500).json({ error: 'Failed to get current shift', message: error.message });
  }
};

exports.updateShiftCash = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { shiftId } = req.params;
    const { type, amount, reason, category, authorizedBy } = req.body;

    if (!['in', 'out'].includes(type)) {
      throw new Error('Invalid operation type. Must be "in" or "out"');
    }

    const numAmount = Number(amount);
    if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
      throw new Error('Invalid amount. Must be a positive number');
    }

    // 1. Find and lock Shift
    const shift = await Shift.findOne({ _id: shiftId, status: 'active' }).session(session);
    if (!shift) throw new Error('Active terminal session not found');

    // 2. Find and lock Account
    const account = await Account.findById(shift.accountId).session(session);
    if (!account) throw new Error('Linked Cash Drawer not found in ledger');

    // 3. Concurrency Guard: Check balance for Pay-outs
    if (type === 'out' && account.balance < numAmount) {
      throw new Error(`Insufficient Drawer Balance! System says: Rs. ${account.balance}`);
    }

    // 4. Atomic Ledger Update
    const snapshotBefore = account.balance;
    const delta = type === 'in' ? numAmount : -numAmount;
    account.balance += delta;
    await account.save({ session });

    // 5. Record Ledger Transaction
    const auditTx = new Transaction({
      account_id: account._id,
      amount: numAmount,
      transaction_type: type === 'in' ? "Deposit" : "Withdrawal",
      reason: `${category || 'Manual Adjustment'}: ${reason || 'N/A'} (Audit Ref: ${shiftId.substring(0, 6)})`,
      balance_after_transaction: account.balance
    });
    await auditTx.save({ session });

    // 6. Log in Shift Register (Forensic Snapshot)
    shift.cashRegister.push({
      entry_type: type,
      amount: numAmount,
      reason: reason,
      category: category || 'Generic',
      authorizedBy: authorizedBy || null,
      transactionId: auditTx._id,
      snapshotBalance: snapshotBefore // Forensic proof of point-in-time balance
    });

    if (type === 'in') {
      shift.cashAdded += numAmount;
    } else {
      shift.cashRemoved += numAmount;
    }

    await shift.save({ session });

    await session.commitTransaction();

    const populatedShift = await Shift.findById(shift._id)
      .populate('accountId', 'account_name balance');

    res.status(200).json({
      message: `Cash ${type === 'in' ? 'Deposit' : 'Withdrawal'} recorded correctly.`,
      shift: {
        ...populatedShift.toObject(),
        calculatedEndCash: populatedShift.calculatedEndCash
      }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Industrial Cash Logic Failed:', error);
    res.status(400).json({
      error: 'Transaction failed',
      message: error.message
    });
  } finally {
    session.endSession();
  }
};