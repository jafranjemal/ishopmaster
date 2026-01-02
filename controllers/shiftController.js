// shiftController.js

const Shift = require('../models/Shift'); // Assuming you have a Shift model
const User = require('../models/User');
const SalesInvoice = require('../models/SalesInvoice');

const Employees = require('../models/Employee');

exports.createShift = async (req, res) => {
  try {
    const newShift = new Shift(req.body);
    await newShift.save();
    res.status(201).json(newShift);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.closeShift = async (req, res) => {
  try {
    const { actualCash, breakdownActuals, notes } = req.body; // breakdownActuals: { "Cash": 500, "Card": 200... }
    const shift = await Shift.findById(req.params.id);
    if (!shift) {
      return res.status(404).json({ message: 'Shift not found' });
    }

    if (actualCash === undefined || actualCash === null) {
      return res.status(400).json({ message: 'Physical cash count is required to close shift' });
    }

    // 1. Reconcile all payments from invoices
    const salesInvoices = await SalesInvoice.find({ invoice_id: { $in: shift.sales } });

    const totals = {
      "Account": 0,
      "Cash": 0,
      "Card": 0,
      "Cheque": 0,
      "Bank Transfer": 0
    };

    salesInvoices.forEach(inv => {
      inv.payment_methods.forEach(pm => {
        if (totals.hasOwnProperty(pm.method)) {
          totals[pm.method] += pm.amount;
        }
      });
    });

    // 2. Map totals to paymentBreakdown
    const breakdown = Object.keys(totals).map(method => {
      const expected = totals[method];
      const actual = method === "Cash" ? actualCash : (breakdownActuals?.[method] || expected);
      return {
        method,
        expected,
        actual,
        mismatch: actual - expected
      };
    });

    shift.paymentBreakdown = breakdown;
    shift.totalCashSales = totals["Cash"];
    shift.totalSales = Object.values(totals).reduce((a, b) => a + b, 0);

    const calculated = shift.calculatedEndCash;
    const discrepancy = actualCash - calculated;

    shift.actualCash = actualCash;
    shift.mismatch = discrepancy;
    shift.isClosed = true;
    shift.status = 'closed';
    shift.endTime = new Date();
    shift.notes = notes;

    await shift.save();

    // Log discrepancy if it exists
    if (discrepancy !== 0) {
      const DiscrepancyLog = require("../models/DiscrepancyLog");
      await DiscrepancyLog.create({
        type: "Cash",
        category: discrepancy < 0 ? "Shortage" : "Excess",
        reference_id: shift._id,
        field_name: "physical_cash",
        expected_value: calculated,
        actual_value: actualCash,
        delta: discrepancy,
        reason: notes || "Shift Closure Mismatch",
        user_id: req.user?._id || shift.userId
      });
    }

    res.status(200).json({
      message: discrepancy === 0 ? 'Shift closed successfully' : 'Shift closed with discrepancy logged',
      shift,
      discrepancy
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
      .populate('userId', 'name employeeId') // Get formatted name
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
      shift.endTime = new Date();
      shift.isClosed = true;
      shift.status = 'closed';
      // Auto-balance cash for forced closure
      shift.calculatedEndCash = (shift.totalCashSales || 0) + shift.startCash + shift.cashAdded - shift.cashRemoved;
      shift.actualCash = shift.calculatedEndCash;
      shift.mismatch = 0;
      shift.notes = (shift.notes || "") + ` [Admin Bulk Closure: ${notes || "Global Deactivate Action"}]`;

      await shift.save();
      closedCount++;
    }

    res.status(200).json({
      message: `Successfully closed ${closedCount} active shifts`,
      count: closedCount
    });
  } catch (error) {
    console.error("Error in bulk close:", error);
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
      startTime: { $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()) },
      isClosed: false,
      status: 'active'
    })
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
    });

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
      console.log("No active shift found for the user.");
      return res.status(404).json({ error: 'No active shift found' });
    }
  } catch (error) {
    console.error('Error getting current shift:', error);
    return res.status(500).json({ error: 'Failed to get current shift', message: error.message });
  }
};

exports.updateShiftCash = async (req, res) => {
  try {
    const { shiftId } = req.params;
    const { type, amount, reason } = req.body;

    // Validate input
    if (!['in', 'out'].includes(type)) {
      return res.status(400).json({
        error: 'Invalid cash operation type. Must be "in" or "out"'
      });
    }

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        error: 'Invalid amount. Must be a positive number'
      });
    }

    // Find active shift
    const shift = await Shift.findOne({
      _id: shiftId,
      status: 'active'
    });

    if (!shift) {
      return res.status(404).json({
        error: 'Active shift not found'
      });
    }

    // Update cash values
    if (type === 'in') {
      shift.cashAdded += Number(amount);
    } else {
      shift.cashRemoved += Number(amount);
    }

    shift.cashRegister.push({ entry_type: type, amount, reason });


    // Save and return updated shift
    await shift.save();

    // Return with calculated end cash
    const result = {
      ...shift.toObject(),
      calculatedEndCash: shift.calculatedEndCash
    };

    return res.status(200).json({
      message: `Cash ${type} updated successfully`,
      shift: result
    });

  } catch (error) {
    console.error('Error updating shift cash:', error);
    return res.status(500).json({
      error: 'Failed to update shift cash',
      message: error.message
    });
  }
};