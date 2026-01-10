const DeviceInspection = require('../models/DeviceInspection');

class DeviceInspectionController {

  // Create a new device inspection
  static async createInspection(req, res) {
    try {
      const inspectionData = req.body;
      const newInspection = new DeviceInspection(inspectionData);
      await newInspection.save();

      // Populate for immediate Receipt generation
      const populatedInspection = await DeviceInspection.findById(newInspection._id)
        .populate('customerId')
        .populate({
          path: 'deviceId',
          populate: [
            { path: 'brandId' },
            { path: 'modelId' }
          ]
        });

      res.status(201).json(populatedInspection);
    } catch (error) {
      console.error("Create Inspection Error:", error);
      res.status(500).json({ message: "Failed to create inspection", error: error.message });
    }
  }

  // Get inspection by ID
  static async getInspectionById(req, res) {
    try {
      const { id } = req.params;
      const inspection = await DeviceInspection.findById(id)
        .populate('deviceId')
        .populate('customerId')
        .populate('assessment.inspectedBy');

      if (!inspection) {
        return res.status(404).json({ message: "Inspection not found" });
      }
      res.status(200).json(inspection);
    } catch (error) {
      res.status(500).json({ message: "Error fetching inspection", error: error.message });
    }
  }

  // Get inspections by Customer ID
  static async getInspectionsByCustomer(req, res) {
    try {
      const { customerId } = req.params;
      const inspections = await DeviceInspection.find({ customerId })
        .sort({ createdAt: -1 });
      res.status(200).json(inspections);
    } catch (error) {
      res.status(500).json({ message: "Error fetching customer inspections", error: error.message });
    }
  }

  // Get ALL inspections (for Dashboard)
  static async getAllInspections(req, res) {
    try {
      const inspections = await DeviceInspection.find()
        .populate({
          path: 'deviceId',
          populate: [
            { path: 'brandId' },
            { path: 'modelId' }
          ]
        })
        .populate('customerId')
        .sort({ createdAt: -1 });
      res.status(200).json(inspections);
    } catch (error) {
      console.error("Get All Inspections Error:", error);
      res.status(500).json({ message: "Error fetching inspections", error: error.message });
    }
  }

  // Update inspection
  static async updateInspection(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const updatedInspection = await DeviceInspection.findByIdAndUpdate(id, updateData, { new: true })
        .populate('customerId')
        .populate({
          path: 'deviceId',
          populate: [
            { path: 'brandId' },
            { path: 'modelId' }
          ]
        });

      if (!updatedInspection) {
        return res.status(404).json({ message: "Inspection not found" });
      }
      res.status(200).json(updatedInspection);
    } catch (error) {
      console.error("Update Inspection Error:", error);
      res.status(500).json({ message: "Error updating inspection", error: error.message });
    }
  }

  // Delete inspection
  static async deleteInspection(req, res) {
    try {
      const { id } = req.params;
      const deletedInspection = await DeviceInspection.findByIdAndDelete(id);
      if (!deletedInspection) {
        return res.status(404).json({ message: "Inspection not found" });
      }
      res.status(200).json({ message: "Inspection deleted successfully" });
    } catch (error) {
      console.error("Delete Inspection Error:", error);
      res.status(500).json({ message: "Error deleting inspection", error: error.message });
    }
  }

  // Get history by Device ID
  static async getHistoryByDevice(req, res) {
    try {
      const { deviceId } = req.params;
      const history = await DeviceInspection.find({ deviceId })
        .populate({
          path: 'deviceId',
          populate: [
            { path: 'brandId' },
            { path: 'modelId' }
          ]
        })
        .populate('customerId')
        .populate('assessment.inspectedBy', 'first_name last_name')
        .sort({ createdAt: -1 });
      res.status(200).json(history);
    } catch (error) {
      console.error("Get Device History Error:", error);
      res.status(500).json({ message: "Error fetching device history", error: error.message });
    }
  }
}

module.exports = DeviceInspectionController;