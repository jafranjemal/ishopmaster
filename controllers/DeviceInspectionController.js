const DeviceInspection = require('../models/DeviceInspection');

class DeviceInspectionController {
  // Create a new device inspection
  static async createDeviceInspection(req, res) {
    try {
      const newInspection = new DeviceInspection(req.body);
      await newInspection.save();
      res.status(201).json(newInspection);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Get all device inspections
  static async getAllDeviceInspections(req, res) {
    try {
      const inspections = await DeviceInspection.find().populate('deviceID inspectedBy');
      res.status(200).json(inspections);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Get a device inspection by ID
  static async getDeviceInspectionById(req, res) {
    try {
      const inspection = await DeviceInspection.findById(req.params.id).populate('deviceID inspectedBy');
      if (!inspection) {
        return res.status(404).json({ message: 'Device inspection not found' });
      }
      res.status(200).json(inspection);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Update a device inspection by ID
  static async updateDeviceInspection(req, res) {
    try {
      const updatedInspection = await DeviceInspection.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!updatedInspection) {
        return res.status(404).json({ message: 'Device inspection not found' });
      }
      res.status(200).json(updatedInspection);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Delete a device inspection by ID
  static async deleteDeviceInspection(req, res) {
    try {
      const deletedInspection = await DeviceInspection.findByIdAndDelete(req.params.id);
      if (!deletedInspection) {
        return res.status(404).json({ message: 'Device inspection not found' });
      }
      res.status(200).json({ message: 'Device inspection deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
}

module.exports = DeviceInspectionController;