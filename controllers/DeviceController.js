const Device = require('../models/Device');

class DeviceController {
  // Create a new device
  static async createDevice(req, res) {
    try {
      const { serialNumber, ...deviceData } = req.body;

      // Check if serial number already exists
      const existingDevice = await Device.findOne({ serialNumber });
      if (existingDevice) {
        return res.status(400).json({ message: 'Serial number already exists' });
      }

      const newDevice = new Device({ serialNumber, ...deviceData });
      await newDevice.save();
      res.status(201).json(newDevice);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Get all devices
  static async getAllDevices(req, res) {
    try {
      const devices = await Device.find()
      .populate('owner')
      .populate('brandId')
      .populate('modelId');
      
      res.status(200).json(devices);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Get a device by ID
  static async getDeviceById(req, res) {
    try {
      const device = await Device.findById(req.params.id);
      if (!device) {
        return res.status(404).json({ message: 'Device not found' });
      }
      res.status(200).json(device);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Update a device by ID
  static async updateDevice(req, res) {
    try {
      const { serialNumber, ...deviceData } = req.body;

      // Check if serial number already exists
      const existingDevice = await Device.findOne({ serialNumber });
      if (existingDevice && existingDevice._id.toString() !== req.params.id) {
        return res.status(400).json({ message: 'Serial number already exists' });
      }

      const updatedDevice = await Device.findByIdAndUpdate(req.params.id, { serialNumber, ...deviceData }, { new: true });
      if (!updatedDevice) {
        return res.status(404).json({ message: 'Device not found' });
      }
      res.status(200).json(updatedDevice);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Delete a device by ID
  static async deleteDevice(req, res) {
    try {
      const deletedDevice = await Device.findByIdAndDelete(req.params.id);
      if (!deletedDevice) {
        return res.status(404).json({ message: 'Device not found' });
      }
      res.status(200).json({ message: 'Device deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Check if serial number exists
  static async checkSerialNumber(req, res) {
    try {
      const { serialNumber } = req.params;
      const existingDevice = await Device.findOne({ serialNumber });
      if (existingDevice) {
        return res.status(200).json({ exists: true });
      }
      res.status(200).json({ exists: false });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
}

module.exports = DeviceController;