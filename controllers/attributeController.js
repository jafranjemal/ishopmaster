const Attribute = require('../models/Attribute');

/**
 * @desc    Get all attributes
 * @route   GET /api/attributes
 * @access  Private
 */
exports.getAttributes = async (req, res) => {
    try {
        const attributes = await Attribute.find().sort({ order: 1, key: 1 });
        res.status(200).json(attributes);
    } catch (error) {
        res.status(500).json({ message: "Error fetching attributes", error: error.message });
    }
};

/**
 * @desc    Create or Update an attribute
 * @route   POST /api/attributes
 * @access  Private
 */
exports.saveAttribute = async (req, res) => {
    const { key, values, description } = req.body;
    try {
        let attribute = await Attribute.findOne({ key: key.toUpperCase() });

        if (attribute) {
            attribute.values = values;
            attribute.description = description;
            await attribute.save();
        } else {
            attribute = await Attribute.create({
                key: key.toUpperCase(),
                values,
                description
            });
        }

        res.status(200).json(attribute);
    } catch (error) {
        res.status(500).json({ message: "Error saving attribute", error: error.message });
    }
};

/**
 * @desc    Delete an attribute
 * @route   DELETE /api/attributes/:id
 * @access  Private
 */
exports.deleteAttribute = async (req, res) => {
    try {
        await Attribute.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Attribute deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting attribute", error: error.message });
    }
};

/**
 * @desc    Helper to bulk seed/migrate attributes (Safe for legacy)
 */
exports.bootstrapAttributes = async (legacyData) => {
    const results = [];
    for (const key in legacyData) {
        if (key === 'Key') continue;
        const values = legacyData[key];

        let attribute = await Attribute.findOne({ key: key.toUpperCase() });
        if (!attribute) {
            attribute = await Attribute.create({
                key: key.toUpperCase(),
                values: values,
                description: `Legacy ${key} attribute`
            });
            results.push(attribute);
        }
    }
    return results;
};

/**
 * @desc    Bulk reorder attributes
 * @route   PUT /api/attributes/reorder
 * @access  Private
 */
exports.reorderAttributes = async (req, res) => {
    const { orders } = req.body; // Array of { id, order }
    try {
        const updates = orders.map(item =>
            Attribute.findByIdAndUpdate(item.id, { order: item.order })
        );
        await Promise.all(updates);
        res.status(200).json({ message: "Order updated successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error reordering attributes", error: error.message });
    }
};
