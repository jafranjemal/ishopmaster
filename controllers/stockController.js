const Stock = require('../models/Stock');
const Item = require('../models/Items');
const mongoose = require('mongoose');
const moment = require('moment'); // To calculate the stock age (optional)

// Create a new stock entry for an item from a purchase
// exports.createStock = async (req, res) => {
//   try {
//     const { item_id, batch_number, purchase_qty, unit_cost, selling_price, purchase_date } = req.body;

//     // Check if the item exists
//     const item = await Item.findById(item_id);
//     if (!item) {
//       return res.status(404).json({ message: 'Item not found' });
//     }

//     // Create new stock record
//     const stock = new Stock({
//       item_id,
//       batch_number,
//       purchase_qty,
//       available_qty: purchase_qty, // Set available quantity to the purchased quantity
//       unit_cost,
//       selling_price,
//       purchase_date,
//       beforePurchaseAvailable_qty: 0, // Assuming before purchase stock was 0
//     });

//     // Save the stock record
//     await stock.save();

//     return res.status(201).json(stock);
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ message: 'Error creating stock' });
//   }
// };

exports.createStock = async (req, res) => {
    try {
      const { item_id, batch_number, purchase_qty, unit_cost, selling_price, purchase_date } = req.body;
  
      // Check if the item exists
      const item = await Item.findById(item_id);
      if (!item) {
        return res.status(404).json({ message: 'Item not found' });
      }
  
      // Find the existing stock of the item across all batches to calculate the beforePurchaseAvailable_qty
      const existingStocks = await Stock.find({ item_id: item_id });
      let totalBeforePurchaseQty = 0;
  
      existingStocks.forEach(stock => {
        totalBeforePurchaseQty += stock.available_qty;
      });
  
      // Create new stock record
      const stock = new Stock({
        item_id,
        batch_number,
        purchase_qty,
        available_qty: purchase_qty, // Set available quantity to the purchased quantity
        unit_cost,
        selling_price,
        purchase_date,
        beforePurchaseAvailable_qty: totalBeforePurchaseQty, // Set before purchase stock
      });
  
      // Save the stock record
      await stock.save();
  
      return res.status(201).json(stock);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Error creating stock' });
    }
  };
// Get stock of an item by its ID
exports.getStockByItem = async (req, res) => {
  try {
    const itemId = req.params.item_id;
    
    const stocks = await Stock.find({ item_id: itemId });
    if (stocks.length === 0) {
      return res.status(404).json({ message: 'No stock found for this item' });
    }

    return res.status(200).json(stocks);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching stock' });
  }
};

// Update stock quantity when items are sold
exports.updateStockOnSale = async (req, res) => {
  try {
    const { item_id, sold_qty, batch_number } = req.body;

    // Find the stock entry for the given item and batch
    const stock = await Stock.findOne({ item_id, batch_number });
    if (!stock) {
      return res.status(404).json({ message: 'Stock not found for this batch' });
    }

    // Ensure there is enough stock available
    if (stock.available_qty < sold_qty) {
      return res.status(400).json({ message: 'Not enough stock available' });
    }

    // Update the available quantity after the sale
    stock.available_qty -= sold_qty;
    await stock.save();

    return res.status(200).json({ message: 'Stock updated successfully', stock });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error updating stock' });
  }
};

// Get the current stock value (unit cost * available qty) of all items
exports.getCurrentStockValue = async (req, res) => {
  try {
    const stocks = await Stock.find();
    if (!stocks || stocks.length === 0) {
      return res.status(404).json({ message: 'No stocks available' });
    }

    let totalValue = 0;
    stocks.forEach(stock => {
      totalValue += stock.available_qty * stock.unit_cost;
    });

    return res.status(200).json({ totalStockValue: totalValue });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error calculating stock value' });
  }
};

// Get stock by batch number for item
exports.getStockByBatch = async (req, res) => {
  try {
    const { item_id, batch_number } = req.params;

    const stock = await Stock.findOne({ item_id, batch_number });
    if (!stock) {
      return res.status(404).json({ message: 'Stock not found for this batch' });
    }

    return res.status(200).json(stock);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching stock by batch' });
  }
};


exports.getAllItemsWithStock = async (req, res) => {
  try {
    // Fetch all items
    const items = await Item.find();

    // Fetch stock details for each item including batch-wise stock details
    const stocks = await Stock.aggregate([
        { $match: { item_id: { $in: items.map(item => item._id) } } }, // Match stocks for these items
        { $group: {
            _id: "$item_id",
            batches: { $push: {
              batch_number: "$batch_number",
              available_qty: "$available_qty",
              purchase_date: "$purchase_date",
              unit_cost: "$unit_cost",
              selling_price: "$selling_price"
            }},
            totalStock: { $sum: "$available_qty" }, // Sum of all available stock
            lastUnitCost: { $last: "$unit_cost" }, // Get the unit_cost of the latest purchase
            lastSellingPrice: { $last: "$selling_price" }, // Get the unit_cost of the latest purchase
          }
        }
      ]);

    // Map the stock details to the corresponding items and calculate the age of stock
    const result = items.map(item => {
      const stock = stocks.find(stock => stock._id.toString() === item._id.toString());

      // If stock data exists for the item, format the response
      if (stock) {
        const batchDetails = stock.batches.map(batch => {
          const ageInDays = moment().diff(moment(batch.purchase_date), 'days'); // Calculate age in days
          return {
            ...batch,
            ageInDays: ageInDays, // Add age in days for each batch
            purchase_date: moment(batch.purchase_date).format('YYYY-MM-DD') // Format date for readability
          };
        });

        return {
          ...item.toObject(),
          totalStock: stock.totalStock,
          batches: batchDetails,
          lastUnitCost: stock.lastUnitCost, // Add last entered unit_cost
          lastSellingPrice: stock.lastSellingPrice, // Add last entered unit_cost
        };
      }

      // If no stock data is found for this item
      return {
        ...item.toObject(),
        totalStock: 0,
        lastUnitCost: 0, // Add last entered unit_cost
        batches: [],
        lastSellingPrice: 0, // Add last entered unit_cost

      };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching items and stock' });
  }
};

// Stock Controller - Get stock for a single item
exports.getStockForItem = async (req, res) => {
    const { item_id } = req.params;
    console.log({item_id})
    try {
        if (!mongoose.Types.ObjectId.isValid(item_id)) {
            throw new Error("Invalid item_id");
          }

      // Fetch stock data for the specific item
      const stock = await Stock.aggregate([
        { $match: { item_id: new mongoose.Types.ObjectId(item_id) } },
        { $group: {
            _id: "$item_id",
            totalStock: { $sum: "$available_qty" }
          }
        }
      ]);
      
      if (!stock.length) {
        return res.status(404).json({ message: 'No stock found for this item' });
      }
  
      res.json({ item_id, totalStock: stock[0].totalStock });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Error fetching stock for item' });
    }
  };

  // Controller to get stock by purchase ID
exports.getStockByPurchaseId = async (req, res) => {
    try {
      const { purchaseId } = req.params;
      const stockData = await Stock.find({ purchase_id: purchaseId })
        .populate("item_id", "itemName") // Assuming "Item" has a "name" field
        .exec();
  
      res.status(200).json(stockData);
    } catch (error) {
      res.status(500).json({ message: "Error fetching stock data", error });
    }
  };
  
