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
      const existingDevice = await Device.findOne({ serialNumber })
        .populate('owner', 'first_name last_name phone_number')
        .populate('brandId')
        .populate('modelId');

      if (existingDevice) {
        return res.status(200).json(existingDevice);
      }
      res.status(200).json(null);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Get devices by Customer ID
  static async getDevicesByCustomer(req, res) {
    try {
      const { customerId } = req.params;
      const devices = await Device.find({ owner: customerId })
        .populate('brandId')
        .populate('modelId')
        .sort({ updatedAt: -1 });
      res.status(200).json(devices);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
  // Promote TEMP-SN to real IMEI/Serial
  static async promoteDevice(req, res) {
    try {
      const { id } = req.params; // Existing TEMP-SN Device ID
      const { newSerialNumber } = req.body;

      if (!newSerialNumber || newSerialNumber.startsWith('TEMP-')) {
        return res.status(400).json({ message: "Invalid real Serial/IMEI" });
      }

      // 1. Check if the real IMEI already exists
      const existingRealDevice = await Device.findOne({ serialNumber: newSerialNumber });

      if (existingRealDevice) {
        // Merge logic: Update all inspections/orders from TEMP-SN ID to Real ID
        const DeviceInspection = require('../models/DeviceInspection');
        // This is a simplified merge - in production, you'd merge RepairOrders too
        await DeviceInspection.updateMany({ deviceId: id }, { deviceId: existingRealDevice._id });

        // Optionally delete the temporary device record
        await Device.findByIdAndDelete(id);

        return res.status(200).json({
          message: "Devices merged successfully",
          deviceId: existingRealDevice._id
        });
      }

      // 2. No existing IMEI? Just update the current record
      const updatedDevice = await Device.findByIdAndUpdate(id, { serialNumber: newSerialNumber }, { new: true });
      res.status(200).json(updatedDevice);

    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
}

module.exports = DeviceController;