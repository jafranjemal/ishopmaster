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
  let committed = false;
  try {
    let { userId, startCash, accountId, sourceAccountId, useExistingBalance } = req.body;

    // --- INPUT SANITIZATION ---
    if (accountId === "") accountId = null;
    if (sourceAccountId === "") sourceAccountId = null;

    if (!accountId) {
      throw new Error("Cash Drawer/Account is required");
    }

    // 0. Worker Lock
    const existingActiveShift = await Shift.findOne({ userId, status: 'active' }).session(session);
    if (existingActiveShift) {
      throw new Error("Worker Lock: You already have an active session!");
    }

    // 1. Fetch Drawer Account
    const drawerAccount = await Account.findById(accountId).session(session);
    if (!drawerAccount) throw new Error("Cash Drawer account not found");

    if (drawerAccount.activeShiftId) {
      throw new Error("Collision Guard: This account is already linked to an active session.");
    }

    const physicalCash = Number(startCash);
    let ledgerBeforeTransfer = drawerAccount.balance || 0;

    // 2. Handle Float Source
    if (!useExistingBalance && sourceAccountId) {
      const vaultAccount = await Account.findById(sourceAccountId).session(session);
      if (!vaultAccount) throw new Error("Source Vault account not found");

      if (vaultAccount.balance < physicalCash) {
        throw new Error(`Insufficient funds in Vault! Available: Rs. ${vaultAccount.balance}`);
      }

      vaultAccount.balance -= physicalCash;
      await vaultAccount.save({ session });

      drawerAccount.balance += physicalCash;
      await drawerAccount.save({ session });

      const vaultTx = new Transaction({
        account_id: vaultAccount._id,
        amount: physicalCash,
        transaction_type: "Withdrawal",
        reason: `Float Transfer to ${drawerAccount.account_name}`,
        balance_after_transaction: vaultAccount.balance
      });
      await vaultTx.save({ session });

      ledgerBeforeTransfer = drawerAccount.balance;
    }

    // 3. Validate Opening Balance
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
      accountId,
      sourceAccountId,
      openingMismatch: openingDiscrepancy,
      status: 'active'
    });
    await newShift.save({ session });

    drawerAccount.activeShiftId = newShift._id;
    await drawerAccount.save({ session });

    // 6. Log Discrepancy
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
    committed = true;

    const populatedShift = await Shift.findById(newShift._id).populate('accountId', 'account_name balance');
    res.status(201).json(populatedShift);
  } catch (error) {
    if (!committed) await session.abortTransaction();
    console.error("Atomic Shift Creation Failed:", error);
    res.status(400).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

exports.closeShift = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  let committed = false;
  try {
    const { actualCash, breakdownActuals, notes, auditMetadata } = req.body;
    const shift = await Shift.findById(req.params.id).session(session);
    if (!shift) throw new Error('Shift not found');
    if (shift.status === 'closed') throw new Error('Terminal already decommissioned');

    if (actualCash === undefined || actualCash === null) {
      throw new Error('Physical cash count is required to close shift');
    }

    const salesInvoices = await SalesInvoice.find({ invoice_id: { $in: shift.sales } }).session(session);
    const totals = { "Account": 0, "Cash": 0, "Card": 0, "Cheque": 0, "Bank Transfer": 0 };
    salesInvoices.forEach(inv => {
      inv.payment_methods.forEach(pm => {
        if (totals.hasOwnProperty(pm.method)) totals[pm.method] += pm.amount;
      });
    });

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
    if (auditMetadata) {
      shift.auditMetadata = auditMetadata;
    }

    await shift.save({ session });

    if (shift.accountId) {
      const account = await Account.findById(shift.accountId).session(session);
      if (account) {
        account.balance = actualCash;
        account.activeShiftId = null;
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
    committed = true;
    res.status(200).json({
      message: discrepancy === 0 ? 'Terminal successfully decommissioned (Balanced)' : 'Terminal decommissioned with audit discrepancy logged',
      shift,
      discrepancy
    });
  } catch (error) {
    if (!committed) await session.abortTransaction();
    console.error("Atomic Shift Closure Failed:", error);
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// [ANALYTICAL] Reconciliation Report: High-fidelity deep dive for a single shift
exports.getShiftReconciliationReport = async (req, res) => {
  try {
    const { id } = req.params;
    const shift = await Shift.findById(id)
      .populate('userId', 'username name')
      .populate('accountId', 'account_name balance')
      .populate('sourceAccountId', 'account_name');

    if (!shift) return res.status(404).json({ message: "Shift analytical record not found" });

    // 1. Financial DNA Calculation
    const totalInflow = shift.cashAdded || 0;
    const totalOutflow = shift.cashRemoved || 0;
    const totalCashSales = shift.totalCashSales || 0;
    const systemExpected = (shift.startCash || 0) + totalCashSales + totalInflow - totalOutflow;

    // 2. Fetch specific logs for this shift
    const DiscrepancyLog = require("../models/DiscrepancyLog");
    const discrepancies = await DiscrepancyLog.find({ reference_id: shift._id });

    // 3. Build the Analytical Payload (as proposed in BUILD mode)
    const payload = {
      header: {
        id: shift._id,
        operator: shift.userId?.name || shift.userId?.username,
        station: shift.accountId?.account_name || "Primary Drawer",
        period: { start: shift.startTime, end: shift.endTime },
        status: shift.status
      },
      financials: {
        opening: shift.startCash,
        sales: shift.totalSales,
        cash_sales: totalCashSales,
        adjustments: { in: totalInflow, out: totalOutflow },
        expected: systemExpected,
        actual: shift.actualCash || shift.finalCalculatedCash || systemExpected,
        variance: shift.mismatch || 0
      },
      payment_matrix: shift.finalPaymentBreakdown?.length > 0 ? shift.finalPaymentBreakdown : shift.paymentBreakdown,
      audit: {
        discrepancies,
        cash_register: shift.cashRegister,
        sales_count: shift.sales.length,
        notes: shift.notes
      }
    };

    res.status(200).json(payload);
  } catch (error) {
    console.error("Analytical Engine Error:", error);
    res.status(500).json({ message: "Failed to generate reconciliation report" });
  }
};

exports.getShifts = async (req, res) => {
  try {
    const { status, startDate, endDate, userId, page = 1, limit = 10, hasMismatch } = req.query;
    let query = {};
    if (status) query.status = status;
    if (userId) query.userId = userId;
    if (startDate && endDate) { query.startTime = { $gte: new Date(startDate), $lte: new Date(endDate) }; }
    if (hasMismatch === 'true') { query.mismatch = { $exists: true, $ne: 0 }; }

    const skip = (page - 1) * limit;
    const total = await Shift.countDocuments(query);
    const shifts = await Shift.find(query)
      .populate('userId', 'username employeeId')
      .populate('accountId', 'account_name')
      .sort({ startTime: -1 })
      .skip(Number(skip))
      .limit(Number(limit));

    // Calculate Summary Stats (Global, not just per page)
    const allActiveShifts = await Shift.find({ status: 'active' });
    const totalActiveCash = allActiveShifts.reduce((acc, s) => acc + (s.calculatedEndCash || 0), 0);
    const totalMismatches = await Shift.countDocuments({ status: 'closed', mismatch: { $exists: true, $ne: 0 } });

    res.status(200).json({
      shifts,
      stats: {
        totalActiveCash,
        totalMismatches,
        activeCount: allActiveShifts.length
      },
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: Number(page),
        limit: Number(limit)
      }
    });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.forceEndShift = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const shift = await Shift.findById(id);
    if (!shift) return res.status(404).json({ message: "Shift not found" });
    if (shift.status !== 'active') return res.status(400).json({ message: "Shift is not active" });
    const calculated = shift.calculatedEndCash;
    shift.actualCash = calculated;
    shift.mismatch = 0;
    shift.isClosed = true;
    shift.status = 'closed';
    shift.endTime = new Date();
    shift.notes = notes ? `${notes} (Admin Forced Closure)` : "Admin Forced Closure";
    await shift.save();
    res.status(200).json({ message: "Shift force-closed successfully", shift });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.closeAllActiveShifts = async (req, res) => {
  try {
    const { notes } = req.body;
    const activeShifts = await Shift.find({ status: 'active', isClosed: false });
    if (activeShifts.length === 0) return res.status(200).json({ message: "No active shifts to close", count: 0 });
    let closedCount = 0;
    for (const shift of activeShifts) {
      const session = await mongoose.startSession();
      session.startTransaction();
      let committed = false;
      try {
        shift.endTime = new Date();
        shift.isClosed = true;
        shift.status = 'closed';
        const calculated = (shift.totalCashSales || 0) + shift.startCash + shift.cashAdded - shift.cashRemoved;
        shift.finalCalculatedCash = calculated;
        shift.finalTotalSales = shift.totalSales || 0;
        shift.actualCash = calculated;
        shift.mismatch = 0;
        shift.notes = (shift.notes || "") + ` [Admin Bulk Decommission: ${notes || "Global Deactivate Action"}]`;
        await shift.save({ session });
        if (shift.accountId) { await Account.findByIdAndUpdate(shift.accountId, { activeShiftId: null, balance: calculated }, { session }); }
        await session.commitTransaction();
        committed = true;
        closedCount++;
      } catch (err) {
        if (!committed) await session.abortTransaction();
        console.error(`Decommission failed for shift ${shift._id}:`, err);
      } finally { session.endSession(); }
    }
    res.status(200).json({ message: `Successfully decommissioned ${closedCount} active terminals`, count: closedCount });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.updateShift = async (req, res) => {
  try {
    const updatedShift = await Shift.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json(updatedShift);
  } catch (error) { res.status(400).json({ message: error.message }); }
};

exports.deleteShift = async (req, res) => {
  try {
    await Shift.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.checkTodayShift = async (req, res) => {
  try {
    const userId = req.params.userId;
    const todayShift = await Shift.findOne({ userId: userId, status: 'active' });
    res.status(200).json(todayShift !== null);
  } catch (error) { res.status(400).json({ message: error.message }); }
};

exports.getCurrentShift = async (req, res) => {
  try {
    const userId = req.params.userId;
    const currentShift = await Shift.findOne({ userId, status: 'active' }).sort({ startTime: -1 }).populate('accountId', 'account_name balance');
    if (currentShift) {
      const user = await User.findById(userId);
      const employee = await Employees.findById(user.employeeId);
      let result = { ...currentShift.toObject(), user, employee, calculatedEndCash: currentShift.calculatedEndCash };
      if (currentShift.sales && currentShift.sales.length > 0) {
        // Optimization: Fetch sales with items to extract serialized units (Phones)
        const sales = await SalesInvoice.find({ invoice_id: { $in: currentShift.sales } })
          .select("invoice_id total_amount total_paid_amount status payment_methods invoice_date items")
          .populate("customer", "name customer_id");

        result.sales = sales;

        // Extract high-value High-Fidelity checklist (Serialized items only)
        const serializedItems = [];
        sales.forEach(sale => {
          sale.items.forEach(item => {
            if (item.isSerialized && item.serialNumbers && item.serialNumbers.length > 0) {
              item.serialNumbers.forEach(sn => {
                serializedItems.push({
                  invoice_id: sale.invoice_id,
                  item_name: item.itemName,
                  serial_number: sn
                });
              });
            }
          });
        });
        result.auditChecklist = serializedItems;
      }
      return res.status(200).json(result);
    }
    return res.status(200).json(null);
  } catch (error) { res.status(500).json({ error: error.message }); }
};

exports.updateShiftCash = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  let committed = false;
  try {
    const { shiftId } = req.params;
    const { type, amount, reason, category, authorizedBy } = req.body;
    if (!['in', 'out'].includes(type)) throw new Error('Invalid operation type');
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) throw new Error('Invalid amount');
    const shift = await Shift.findOne({ _id: shiftId, status: 'active' }).session(session);
    if (!shift) throw new Error('Active session not found');
    const account = await Account.findById(shift.accountId).session(session);
    if (!account) throw new Error('Linked Cash Drawer not found');
    if (type === 'out' && account.balance < numAmount) throw new Error(`Insufficient Balance: Rs. ${account.balance}`);
    const snapshotBefore = account.balance;
    const delta = type === 'in' ? numAmount : -numAmount;
    account.balance += delta;
    await account.save({ session });
    const auditTx = new Transaction({ account_id: account._id, amount: numAmount, transaction_type: type === 'in' ? "Deposit" : "Withdrawal", reason: `${category || 'Manual'}: ${reason || 'N/A'}`, balance_after_transaction: account.balance });
    await auditTx.save({ session });
    shift.cashRegister.push({ entry_type: type, amount: numAmount, reason, category: category || 'Generic', authorizedBy, transactionId: auditTx._id, snapshotBalance: snapshotBefore });
    if (type === 'in') { shift.cashAdded += numAmount; } else { shift.cashRemoved += numAmount; }
    await shift.save({ session });
    await session.commitTransaction();
    committed = true;
    const populatedShift = await Shift.findById(shift._id).populate('accountId', 'account_name balance');
    res.status(200).json({ message: `Cash ${type} recorded`, shift: { ...populatedShift.toObject(), calculatedEndCash: populatedShift.calculatedEndCash } });
  } catch (error) {
    if (!committed) await session.abortTransaction();
    res.status(400).json({ message: error.message });
  } finally { session.endSession(); }
};