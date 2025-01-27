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
        const shift = await Shift.findById(req.params.id);
        if (!shift) {
            return res.status(404).json({ message: 'Shift not found' });
        }

        await shift.closeShift(); // Call the method to close the shift
        res.status(200).json(shift);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getShifts = async (req, res) => {
    try {
        const shifts = await Shift.find();
        res.status(200).json(shifts);
    } catch (error) {
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
      
        console.log("current shift ", currentShift)
        if (currentShift) {
          const user = await User.findById(userId);
          
          if(!user) return res.status(404).json({ error: 'No active shift found' });
          const employee = await Employees.findById(user.employeeId);
      
          let result = {
            ...currentShift.toObject(),
            user,
            employee,
            calculatedEndCash: currentShift.calculatedEndCash
          };
      
          if (currentShift.sales && currentShift.sales.length > 0) {
            const sales = await SalesInvoice.find({ invoice_id: { $in: currentShift.sales } });
            result.sales = sales;
          }
      
          console.log(result);
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
      const { type, amount , reason } = req.body;
  
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

      shift.cashRegister.push({type, amount, reason});

  
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