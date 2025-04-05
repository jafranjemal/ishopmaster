const Stock = require("../models/Stock");
const Item = require("../models/Items");
const mongoose = require("mongoose");
const moment = require("moment"); // To calculate the stock age (optional)
const NonSerializedStock = require("../models/NonSerializedStock");
const SerializedStock = require("../models/SerializedStock");
const Items = require("../models/Items");

exports.getItemStockDetails = async (req, res) => {
  try {
    const { itemId } = req.params;

    // Validate itemId
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ message: "Invalid itemId format" });
    }

    // Check if the item exists and get its serialized status
    const item = await Items.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    let stockDetails = [];

    if (item.serialized) {
      // Fetch serialized stock details
      stockDetails = await SerializedStock.aggregate([
        {
          $match: { item_id: new mongoose.Types.ObjectId(itemId) },
        },
        {
          $group: {
            _id: "$item_id",
            totalStock: {
              $sum: { $cond: [{ $eq: ["$status", "Available"] }, 1, 0] },
            },
            soldQty: { $sum: { $cond: [{ $eq: ["$status", "Sold"] }, 1, 0] } },
            adjustmentQty: {
              $sum: { $cond: [{ $eq: ["$status", "Damaged"] }, 1, 0] },
            },
            unitCost: { $first: "$unitCost" },
            sellingPrice: { $first: "$sellingPrice" },

            expiryDate: { $first: "$expiryDate" },
            batches: {
              $push: {
                batch_number: "$batch_number",
                serialNumber: "$serialNumber",
                purchaseDate: "$purchaseDate",
                unitCost: "$unitCost",
                sellingPrice: "$sellingPrice",
                purchaseDate: "$purchaseDate",
                purchase_id: "$purchase_id",
              },
            },
          },
        },
      ]);
    } else {
      // Fetch non-serialized stock details
      stockDetails = await NonSerializedStock.aggregate([
        {
          $match: { item_id: new mongoose.Types.ObjectId(itemId) },
        },
        {
          $group: {
            _id: "$item_id",
            totalStock: { $sum: "$availableQty" },
            soldQty: { $sum: "$soldQty" },
            soldQty: { $sum: "$soldQty" },
            adjustmentQty: { $sum: "$adjustmentQty" },
            unitCost: { $first: "$unitCost" },
            sellingPrice: { $first: "$sellingPrice" },
            expiryDate: { $first: "$expiry_date" },
            batches: {
              $push: {
                batch_number: "$batch_number",
                availableQty: "$availableQty",
                unitCost: "$unitCost",
                purchaseDate: "$purchaseDate",
                purchase_id: "$purchase_id",
                sellingPrice: "$sellingPrice",
              },
            },
          },
        },
      ]);
    }

    // Respond with stock details
    return res.status(200).json({
      ...item.toObject(),
      stockDetails: stockDetails[0],
    });
  } catch (error) {
    console.error("Error fetching stock details:", error);
    return res.status(500).json({
      message: "An error occurred while fetching stock details",
      error: error.message,
    });
  }
};

exports.createStock = async (req, res) => {
  try {
    const {
      item_id,
      batch_number,
      purchase_qty,
      unitCost,
      sellingPrice,
      purchaseDate,
    } = req.body;

    // Check if the item exists
    const item = await Item.findById(item_id);
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    // Find the existing stock of the item across all batches to calculate the beforePurchaseAvailable_qty
    const existingStocks = await Stock.find({ item_id: item_id });
    let totalBeforePurchaseQty = 0;

    existingStocks.forEach((stock) => {
      totalBeforePurchaseQty += stock.availableQty;
    });

    // Create new stock record
    const stock = new Stock({
      item_id,
      batch_number,
      purchase_qty,
      availableQty: purchase_qty, // Set available quantity to the purchased quantity
      unitCost,
      sellingPrice,
      purchaseDate,
      beforePurchaseAvailable_qty: totalBeforePurchaseQty, // Set before purchase stock
    });

    // Save the stock record
    await stock.save();

    return res.status(201).json(stock);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error creating stock" });
  }
};
// Get stock of an item by its ID
exports.getStockByItem = async (req, res) => {
  try {
    const itemId = req.params.item_id;

    const stocks = await Stock.find({ item_id: itemId });
    if (stocks.length === 0) {
      return res.status(404).json({ message: "No stock found for this item" });
    }

    return res.status(200).json(stocks);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error fetching stock" });
  }
};

// Update stock quantity when items are sold
exports.updateStockOnSale = async (req, res) => {
  try {
    const { item_id, soldQty, batch_number } = req.body;

    // Find the stock entry for the given item and batch
    const stock = await Stock.findOne({ item_id, batch_number });
    if (!stock) {
      return res
        .status(404)
        .json({ message: "Stock not found for this batch" });
    }

    // Ensure there is enough stock available
    if (stock.availableQty < soldQty) {
      return res.status(400).json({ message: "Not enough stock available" });
    }

    // Update the available quantity after the sale
    stock.availableQty -= soldQty;
    await stock.save();

    return res
      .status(200)
      .json({ message: "Stock updated successfully", stock });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error updating stock" });
  }
};

// Get the current stock value (unit cost * available qty) of all items
exports.getCurrentStockValue = async (req, res) => {
  try {
    const stocks = await Stock.find();
    if (!stocks || stocks.length === 0) {
      return res.status(404).json({ message: "No stocks available" });
    }

    let totalValue = 0;
    stocks.forEach((stock) => {
      totalValue += stock.availableQty * stock.unitCost;
    });

    return res.status(200).json({ totalStockValue: totalValue });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error calculating stock value" });
  }
};

// Get stock by batch number for item
exports.getStockByBatch = async (req, res) => {
  try {
    const { item_id, batch_number } = req.params;

    const stock = await Stock.findOne({ item_id, batch_number });
    if (!stock) {
      return res
        .status(404)
        .json({ message: "Stock not found for this batch" });
    }

    return res.status(200).json(stock);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error fetching stock by batch" });
  }
};

exports.getAllItemsWithStock_old = async (req, res) => {
  try {
    // Fetch all items
    const items = await Item.find();

    // Fetch stock details for each item including batch-wise stock details
    const stocks = await Stock.aggregate([
      { $match: { item_id: { $in: items.map((item) => item._id) } } }, // Match stocks for these items
      {
        $group: {
          _id: "$item_id",
          batches: {
            $push: {
              batch_number: "$batch_number",
              availableQty: "$availableQty",
              purchaseDate: "$purchaseDate",
              unitCost: "$unitCost",
              sellingPrice: "$sellingPrice",
            },
          },
          totalStock: { $sum: "$availableQty" }, // Sum of all available stock
          lastUnitCost: { $last: "$unitCost" }, // Get the unitCost of the latest purchase
          lastSellingPrice: { $last: "$sellingPrice" }, // Get the unitCost of the latest purchase
          serialized: { $last: "$serialized" }, // Get the unitCost of the latest purchase
        },
      },
    ]);

    // Map the stock details to the corresponding items and calculate the age of stock
    const result = items.map((item) => {
      const stock = stocks.find(
        (stock) => stock._id.toString() === item._id.toString()
      );

      // If stock data exists for the item, format the response
      if (stock) {
        const batchDetails = stock.batches.map((batch) => {
          const ageInDays = moment().diff(moment(batch.purchaseDate), "days"); // Calculate age in days
          return {
            ...batch,
            ageInDays: ageInDays, // Add age in days for each batch
            purchaseDate: moment(batch.purchaseDate).format("YYYY-MM-DD"), // Format date for readability
          };
        });

        return {
          ...item.toObject(),
          totalStock: stock.totalStock,
          batches: batchDetails,
          lastUnitCost: stock.lastUnitCost, // Add last entered unitCost
          lastSellingPrice: stock.lastSellingPrice, // Add last entered unitCost
          // Add last entered unitCost
        };
      }

      // If no stock data is found for this item
      return {
        ...item.toObject(),
        totalStock: 0,
        lastUnitCost: 0, // Add last entered unitCost
        batches: [],
        lastSellingPrice: 0, // Add last entered unitCost
        // Add last entered unitCost
      };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching items and stock" });
  }
};

exports.getAllItemsWithStock = async (req, res) => {
  try {
    const result = await Stock.aggregate([
      {
        $lookup: {
          from: "items",
          localField: "item_id",
          foreignField: "_id",
          as: "itemDetails",
        },
      },
      {
        $unwind: {
          path: "$itemDetails",
          preserveNullAndEmptyArrays: false, // Ensure items without stock are still included
        },
      },
      {
        $addFields: {
          serialized: { $ifNull: ["$itemDetails.serialized", false] }, // Default serialized to false if not found
        },
      },
      {
        $group: {
          _id: "$item_id",
          batches: {
            $push: {
              batch_number: "$batch_number",
              availableQty: "$availableQty",
              purchaseDate: "$purchaseDate",
              unitCost: "$unitCost",
              sellingPrice: "$sellingPrice",
            },
          },
          totalStock: { $sum: "$availableQty" },
          lastUnitCost: { $last: "$unitCost" },
          lastSellingPrice: { $last: "$sellingPrice" },
          serialized: { $last: "$serialized" },
          itemDetails: { $first: "$itemDetails" },
        },
      },
      {
        $project: {
          _id: 0,
          item_id: "$_id",
          totalStock: 1,
          lastUnitCost: 1,
          lastSellingPrice: 1,
          serialized: 1,
          batches: 1,
          itemDetails: 1,
        },
      },
    ]);

    // Format the result
    const formattedResult = result.map((item) => {
      const batchDetails = item.batches.map((batch) => {
        const ageInDays = moment().diff(moment(batch.purchaseDate), "days");
        return {
          ...batch,
          ageInDays: ageInDays,
          purchaseDate: moment(batch.purchaseDate).format("YYYY-MM-DD"),
        };
      });

      return {
        ...item.itemDetails,
        totalStock: item.totalStock,
        batches: batchDetails,
        lastUnitCost: item.lastUnitCost,
        lastSellingPrice: item.lastSellingPrice,
        serialized: item.serialized,
      };
    });

    res.json(formattedResult);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Error fetching items and stock", error: err.message });
  }
};

// Stock Controller - Get stock for a single item
exports.getStockForItem = async (req, res) => {
  const { item_id } = req.params;
  console.log({ item_id });
  try {
    if (!mongoose.Types.ObjectId.isValid(item_id)) {
      throw new Error("Invalid item_id");
    }

    // Fetch stock data for the specific item
    const stock = await Stock.aggregate([
      { $match: { item_id: new mongoose.Types.ObjectId(item_id) } },
      {
        $group: {
          _id: "$item_id",
          totalStock: { $sum: "$availableQty" },
        },
      },
    ]);

    if (!stock.length) {
      return res.status(404).json({ message: "No stock found for this item" });
    }

    res.json({ item_id, totalStock: stock[0].totalStock });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching stock for item" });
  }
};

// Controller to get stock by purchase ID
exports.getStockByPurchaseId_old = async (req, res) => {
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

// Controller to get stock by purchase ID
exports.getStockByPurchaseId = async (req, res) => {
  try {
    const { purchaseId } = req.params;

    // Fetch non-serialized stock details
    const nonSerializedStocks1 = await NonSerializedStock.find(
      { purchase_id: purchaseId },
      {
        item_id: 1,
        batch_number: 1,
        purchaseDate: 1,
        purchase_qty: 1,
        availableQty: 1,
        soldQty: 1,
        adjustmentQty: 1,
        unitCost: 1,
        sellingPrice: 1,
        expiry_date: 1,
        adjustment_reason: 1,
      }
    );

    // item_id: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    // purchase_id: { type: mongoose.Schema.Types.ObjectId, ref: "Purchase", required: true },
    // batch_number: { type: String, required: true }, // Unique for batch
    // purchaseQty: { type: Number, required: true }, // Total quantity purchased
    // availableQty: { type: Number, required: true }, // Remaining stock
    // soldQty: { type: Number, default: 0 }, // Quantity sold
    // adjustmentQty: { type: Number, default: 0 }, // Adjustments for returns, damages
    // unitCost: { type: Number, required: true }, // Purchase price per unit
    // beforePurchaseAvailableQty: { type: Number, required: false, default:0 }, // Purchase price per unit
    // sellingPrice: { type: Number, required: true }, // Selling price per unit
    // expiryDate: { type: Date }, // Optional: Expiry date for consumables
    // adjustmentReason: { type: String }, // Optional: Reason for adjustment
    // unit: { type: String }, // Optional: Reason for adjustment
    // purchaseDate: { type: Date, required: true },
    const nonSerializedStocks = await NonSerializedStock.aggregate([
      { $match: { purchase_id: new mongoose.Types.ObjectId(purchaseId) } },
      {
        $lookup: {
          from: "items", // Replace "items" with the actual name of your items collection
          localField: "item_id",
          foreignField: "_id",
          as: "itemDetails",
        },
      },
      {
        $unwind: "$itemDetails",
      },
      {
        $group: {
          _id: "$item_id",
          totalStock: { $sum: "$availableQty" }, // Sum of availableQty
          beforePurchaseAvailableQty: { $last: "$beforePurchaseAvailableQty" }, // Sum of availableQty
          purchaseQty: { $last: "$purchaseQty" }, // Sum of availableQty
          purchaseDate: { $last: "$purchaseDate" }, // Sum of availableQty
          batch_number: { $last: "$batch_number" },
          lastUnitCost: { $last: "$unitCost" }, // Count of available serialized items
          soldQty: { $sum: "$soldQty" },
          adjustmentQty: { $sum: "$adjustmentQty" },
          sellingPrice: { $sum: "$sellingPrice" },
          unitCost: { $sum: "$unitCost" },
          expiryDate: { $last: "$expiryDate" },
          itemId: { $last: "$item_id" },
          itemName: { $first: "$itemDetails.itemName" }, // Use itemDetails from lookup

          batches: {
            $push: {
              batch_number: "$batch_number",
              availableQty: "$availableQty",
              purchaseDate: "$purchaseDate",
              unitCost: "$unitCost",
              sellingPrice: "$sellingPrice",
            },
          },
        },
      },
    ]);

    const serializedStocks = await SerializedStock.aggregate([
      {
        $match: { purchase_id: new mongoose.Types.ObjectId(purchaseId) },
      },
      {
        $lookup: {
          from: "items", // Replace "items" with the actual name of your items collection
          localField: "item_id",
          foreignField: "_id",
          as: "itemDetails",
        },
      },
      {
        $unwind: "$itemDetails",
      },
      {
        $group: {
          _id: "$item_id",
          totalStock: { $sum: 1 },
          purchaseQty: { $sum: 1 },
          soldQty: { $sum: { $cond: [{ $eq: ["$status", "Sold"] }, 1, 0] } },
          adjustmentQty: {
            $sum: { $cond: [{ $eq: ["$status", "Damaged"] }, 1, 0] },
          },
          unitCost: { $first: "$unitCost" },
          itemName: { $first: "$itemDetails.itemName" }, // Use itemDetails from lookup
          sellingPrice: { $first: "$sellingPrice" },
          purchaseDate: { $first: "$purchaseDate" },
          expiryDate: { $first: "$expiryDate" },
          batch_number: { $first: "$batch_number" },
          serialNumber: { $push: "$serialNumber" },
          itemId: { $last: "$item_id" },
          batches: {
            $push: {
              batch_number: "$batch_number",
              serialNumber: "$serialNumber",
              purchaseDate: "$purchaseDate",
              availableQty: {
                $cond: [{ $eq: ["$status", "Available"] }, 1, 0],
              },
              unitCost: "$unitCost",
              sellingPrice: "$sellingPrice",
            },
          },
        },
      },
    ]);

    // Merge non-serialized and serialized stock data
    const mergedStocks = nonSerializedStocks.map((nonSerialized) => ({
      ...nonSerialized,
      profit_margin:
        ((nonSerialized.sellingPrice - nonSerialized.unitCost) /
          nonSerialized.sellingPrice) *
        100,
    }));

    serializedStocks.forEach((serialized) => {
      mergedStocks.push(serialized);
      // mergedStocks.push({
      //   item_id: serialized._id,
      //   batch_number: "N/A", // Serialized items might not have a batch number
      //   purchaseDate: serialized.purchaseDate,
      //   purchase_qty: serialized.totalStock,
      //   availableQty: serialized.totalStock - serialized.soldQty - serialized.adjustmentQty,
      //   soldQty: serialized.soldQty,
      //   adjustmentQty: serialized.adjustmentQty,
      //   unitCost: serialized.unitCost,
      //   sellingPrice: serialized.sellingPrice,
      //   profit_margin: ((serialized.sellingPrice - serialized.unitCost) / serialized.sellingPrice) * 100,
      //   expiry_date: serialized.expiry_date || null,
      //   adjustment_reason: "N/A", // Serialized items might not have an adjustment reason
      // });
    });

    res.status(200).json(mergedStocks);
  } catch (error) {
    console.error("Error fetching stock data by purchase ID:", error);
    res.status(500).json({ message: "Error fetching stock data", error });
  }
};

exports.getUnifiedStock = async (req, res) => {
  try {
    // Fetch all items
    const items = await Items.find();
 

    const nonSerializedStocks = await NonSerializedStock.aggregate([
      {
        $group: {
          _id: "$item_id",
          item_id: { $last: "$item_id" },
          totalStock: { $sum: "$availableQty" }, // Sum of availableQty
          totalSold: { $sum: "$soldQty" }, // Sum of availableQty
          lastSellingPrice: { $last: "$sellingPrice" },
          lastUnitCost: { $last: "$unitCost" }, // Count of available serialized items
          batches: {
            $push: {
              
              batch_number: "$batch_number",
              availableQty: "$availableQty",
              purchaseDate: "$purchaseDate",
              unitCost: "$unitCost",
              sellingPrice: "$sellingPrice",
              purchase_id: "$purchase_id",
            },
          },
        },
      },
      {
        $unwind: "$batches",
      },
      {
        $lookup: {
          from: "purchases", // Name of the purchases collection
          localField: "batches.purchase_id",
          foreignField: "_id",
          as: "purchase_info",
        },
      },
      {
        $unwind: "$purchase_info",
      },
      {
        $sort: { "batches.purchaseDate": -1 } // Sort by purchaseDate
      },
      {
        $lookup: {
          from: "suppliers", // Name of the suppliers collection
          localField: "purchase_info.supplier",
          foreignField: "_id",
          as: "supplier_info",
        },
      },
      {
        $unwind: "$supplier_info",
      },
      {
        $group: {
          _id:   "$item_id" ,
          totalStock: { $first: "$totalStock" },
          totalSold: { $first: "$soldQty" }, // Sum of availableQty

          
          lastSellingPrice: { $first: "$lastSellingPrice" },
          lastUnitCost: { $first: "$lastUnitCost" },
          batches: {
            $push: {
              item_id:  "$item_id" ,
              batch_number: "$batches.batch_number",
              availableQty: "$batches.availableQty",
              purchaseDate: "$batches.purchaseDate",
              unitCost: "$batches.unitCost",
              sellingPrice: "$batches.sellingPrice",
              purchase_id: "$batches.purchase_id",
              purchase: "$purchase_info",
              supplier: "$supplier_info",
            },
          },
        },
      },
       
      { $sort: { totalStock: -1 } },
    ]);

    // console.log(nonSerializedStocks);

    // Fetch serialized stock details
    const serializedStocks = await SerializedStock.aggregate([
      {
        $match: { status: "Available" } // Filter only available serialized items
      },
      {
        $group: {
          _id: "$item_id",
          item_id: { $last: "$item_id" },
          totalStock: { $sum: 1 }, // Count of available serialized items
          lastSellingPrice: { $last: "$sellingPrice" },
          lastUnitCost: { $last: "$unitCost" },
          batches: {
            $push: {
              batch_number: "$batch_number",
              serialNumber: "$serialNumber",
              status: "$status",
              purchaseDate: "$purchaseDate",
              unitCost: "$unitCost",
              sellingPrice: "$sellingPrice",
              purchase_id: "$purchase_id",
            }
          }
        }
      },
      { $unwind: "$batches" },
      {
        $lookup: {
          from: "purchases", // Name of the purchases collection
          localField: "batches.purchase_id",
          foreignField: "_id",
          as: "purchase_info"
        }
      },
      { $unwind: "$purchase_info" },
      {
        $sort: { "batches.purchaseDate": -1 } // Sort by purchaseDate
      },
      {
        $lookup: {
          from: "suppliers", // Name of the suppliers collection
          localField: "purchase_info.supplier",
          foreignField: "_id",
          as: "supplier_info"
        }
      },
      { $unwind: "$supplier_info" },
      {
        $group: {
          _id:   "$item_id" ,
          totalStock: { $first: "$totalStock" },
          lastSellingPrice: { $first: "$lastSellingPrice" },
          lastUnitCost: { $first: "$lastUnitCost" },
          batches: {
            $push: {
              item_id: "$item_id" ,
              batch_number: "$batches.batch_number",
              serialNumber: "$batches.serialNumber",
              status: "$batches.status",
              purchaseDate: "$batches.purchaseDate",
              unitCost: "$batches.unitCost",
              sellingPrice: "$batches.sellingPrice",
              purchase_id: "$batches.purchase_id",
              purchase: "$purchase_info",
              supplier: "$supplier_info"
            }
          }
        }
      },
      
      { $sort: { totalStock: -1 } }
    ]);
    
    console.log(serializedStocks);
    

    // Map and merge stock data into a unified result
    const result = items.map((item) => {
      const nonSerialized = nonSerializedStocks.find(
        (stock) => stock._id.toString() === item._id.toString()
      );
      const serialized = serializedStocks.find(
        (stock) => stock._id.toString() === item._id.toString()
      );

      const lastSellingPrice = item.serialized
        ? serialized?.lastSellingPrice || 0
        : nonSerialized?.lastSellingPrice || 0;

      const lastUnitCost = item.serialized
        ? serialized?.lastUnitCost || 0
        : nonSerialized?.lastUnitCost || 0;

      return {
        ...item.toObject(),

        lastSellingPrice,
        lastUnitCost,

        isSerialized: item.serialized,
        totalStock:
          (nonSerialized?.totalStock || 0) + (serialized?.totalStock || 0),
        batches: nonSerialized?.batches || serialized?.batches,
        serializedItems: serialized?.batches || [],
      };
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching unified stock data" });
  }
};
