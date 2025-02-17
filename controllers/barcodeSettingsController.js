const BarcodeSettings = require('../models/BarcodeSettings');

exports.saveSettings = async (req, res) => {
  try {
    const settings = new BarcodeSettings(req.body);
    await settings.save();
    res.status(201).json({ message: 'Settings saved successfully', settings });
  } catch (error) {
    res.status(500).json({ message: 'Error saving settings', error });
  }
};

 
// Update settings
exports.updateSettings = async (req, res) => {
  try {
    const settings = await BarcodeSettings.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }
    res.status(200).json({ message: 'Settings updated successfully', settings });
  } catch (error) {
    res.status(500).json({ message: 'Error updating settings', error });
  }
}

// Delete settings
exports.deleteSettings = async (req, res) => {
  try {
    const settings = await BarcodeSettings.findByIdAndDelete(req.params.id);
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }
    res.status(200).json({ message: 'Settings deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting settings', error });
  }
}

// Get all settings
exports.getAllSettings = async (req, res) => {
  try {
    const settings = await BarcodeSettings.find({});
    if (settings.length === 0) {
      return res.status(404).json({ message: 'No settings found' });
    }
    console.log('Settings retrieved successfully', settings);
    res.status(200).json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving settings', error });
  }
}

// Get settings by ID
exports.getSettingsById = async (req, res) => {
  try {
    const settings = await BarcodeSettings.findById(req.params.id);
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }
    res.status(200).json({ message: 'Settings retrieved successfully', settings });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving settings', error });
  }
}
