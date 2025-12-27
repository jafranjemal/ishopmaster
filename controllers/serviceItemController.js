const ServiceItem = require("../models/ServiceItem");

// ✅ Create a new service item
exports.createServiceItem = async (req, res) => {
  try {
    const { name, description, brand, modelVariants, category, status } = req.body;

    if (!name || !description || !brand || !modelVariants || !category) {
      return res.status(400).json({ message: "All required fields must be filled!" });
    }

    const newServiceItem = new ServiceItem(req.body);

    await newServiceItem.save();
    res.status(201).json({ message: "Service item created successfully!", data: newServiceItem });
  } catch (error) {
    res.status(500).json({ message: "Server error!", error: error.message });
  }
};

// ✅ Get all service items with pagination, filtering, and sorting
exports.getAllServiceItems = async (req, res) => {
  try {
    // Extract pagination params
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Extract search and filter params
    const search = req.query.search || '';
    const category = req.query.category || '';
    const manufacturer = req.query.manufacturer || '';
    const modelName = req.query.modelName || '';
    const barcode = req.query.barcode || '';
    const itemName = req.query.itemName || '';
    const itemDescription = req.query.itemDescription || '';

    // Extract sort params
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;

    // Build filter query
    let filter = {};

    // Global search across multiple fields
    if (search) {
      filter.$or = [
        { itemName: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { manufacturer: { $regex: search, $options: 'i' } },
        { modelName: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } },
        { itemDescription: { $regex: search, $options: 'i' } }
      ];
    }

    // Individual field filters
    if (category) filter.category = { $regex: category, $options: 'i' };
    if (manufacturer) filter.manufacturer = { $regex: manufacturer, $options: 'i' };
    if (modelName) filter.modelName = { $regex: modelName, $options: 'i' };
    if (barcode) filter.barcode = { $regex: barcode, $options: 'i' };
    if (itemName) filter.itemName = { $regex: itemName, $options: 'i' };
    if (itemDescription) filter.itemDescription = { $regex: itemDescription, $options: 'i' };

    // Count total documents (for pagination metadata)
    const total = await ServiceItem.countDocuments(filter);

    // Fetch paginated data
    const serviceItems = await ServiceItem.find(filter)
      .populate("brand", "name image")
      .populate("modelVariants.modelId", "model_name image_url")
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit);

    const serviceItemsWithPriceRange = serviceItems.map(item => ({
      ...item.toObject(),
      priceRange: item.priceRange
    }));

    // Return paginated response
    res.status(200).json({
      message: "Service items retrieved!",
      data: serviceItemsWithPriceRange,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ message: "Server error!", error: error.message });
  }
};

// ✅ checkExistServiceItems

exports.checkExistServiceItems = async (req, res) => {
  try {
    // Validate the request body
    if (!req.body.name || !req.body.category || !req.body.brand) {
      return res.status(400).json({ message: "Name, category, and brand are required." });
    }

    // Find service items based on the provided criteria
    const serviceItems = await ServiceItem.find({
      name: req.body.name,
      category: req.body.category,
      brand: req.body.brand,
    });

    // Return a 200 status if no service items are found, otherwise return a 409 status
    if (serviceItems.length === 0) {
      return res.status(200).json({ message: "Service item does not exist. You can proceed with creation." });
    }

    res.status(409).json({ message: "Service item already exists. Please try a different combination." });
  } catch (error) {
    // Log the error for debugging purposes
    console.error(error);

    // Return a 500 status with a generic error message
    res.status(500).json({ message: "Server error. Please try again later." });
  }
};

// ✅ Get a single service item by ID
exports.getServiceItemById = async (req, res) => {
  try {
    const { id } = req.params;
    const serviceItem = await ServiceItem.findById(id)
      .populate("brand", "name image")
      .populate("modelVariants.modelId", "model_name image_url");

    if (!serviceItem) {
      return res.status(404).json({ message: "Service item not found!" });
    }

    res.status(200).json({ message: "Service item found!", data: serviceItem });
  } catch (error) {
    res.status(500).json({ message: "Server error!", error: error.message });
  }
};

// ✅ Update a service item
exports.updateServiceItem = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedServiceItem = await ServiceItem.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedServiceItem) {
      return res.status(404).json({ message: "Service item not found!" });
    }

    res.status(200).json({ message: "Service item updated!", data: updatedServiceItem });
  } catch (error) {
    res.status(500).json({ message: "Server error!", error: error.message });
  }
};

// ✅ Delete a service item
exports.deleteServiceItem = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedServiceItem = await ServiceItem.findByIdAndDelete(id);

    if (!deletedServiceItem) {
      return res.status(404).json({ message: "Service item not found!" });
    }

    res.status(200).json({ message: "Service item deleted successfully!" });
  } catch (error) {
    res.status(500).json({ message: "Server error!", error: error.message });
  }
};
