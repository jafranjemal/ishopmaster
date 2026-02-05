const mongoose = require("mongoose");

const ItemSchema = new mongoose.Schema(
  {
    // Common Fields for All Items
    itemName: { type: String, required: true, unique: true }, // Item Name
    itemImage: { type: String }, // Image URL
    itemImagePublicId: { type: String }, // Cloudinary Public ID
    units: { type: String, default: "pcs" },
    alertQuantity: { type: String, default: "0" },
    notForSelling: { type: Boolean, default: false },
    category: {
      type: String,
      required: true,
      enum: ["Device", "Accessory", "Spare Part", "Consumable", "Tool"],
    }, // Item Type
    itemDescription: { type: String }, // Optional description
    manufacturer: { type: String }, // Manufacturer name
    manufacturerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', default: null }, // Link to Brand
    phoneModelId: { type: mongoose.Schema.Types.ObjectId, ref: "PhoneModel", default: null }, // Link to PhoneModel
    modelName: { type: String }, // Model name (Text fallback/cache)
    barcode: { type: String, unique: true }, // Unique barcode (if applicable)

    costPrice: { type: Number }, // Purchase cost for not selling items    
    purchaseDate: { type: Date },

    //requiresIMEI: { type: Boolean, default: false }, // New flag field for IMEI requirement
    serialized: { type: Boolean, default: false }, // Determines if item is serialized

    // Fields Specific to Devices

    deviceCategory: { type: String },
    deviceSubCategory: { type: String },
    //depricated fields 
    //ramSize: { type: String }, 
    //storageSize: { type: String }, 
    //displaySize: { type: String }, 
    //rearCamera: { type: String }, 
    //frontCamera: { type: String }, 
    //fingerprint: { type: Boolean }, 
    //networkType: { type: String }, 
    //simType: { type: String }, // SIM type (e.g., Nano)
    //batteryCapacity: { type: Number }, // Number of SIM slots
    //batteryHealth: { type: Number }, // Number of SIM slots




    // Fields Specific to Accessories
    compatibility: [{ type: String }], // Compatible devices
    accessoryCategory: { type: String }, // Compatible devices


    // Fields Specific to Spare Parts
    sparePartDetails: {
      partNumber: { type: String }, // Part number for identification
      compatibleModels: [{ type: String }], // Compatible models
    },

    sparePartCategory: { type: String },

    // Fields Specific to Consumables
    consumableCategory: { type: String }, // Category for consumables
    consumableDetails: {
      usageUnit: { type: String, enum: ["ml", "g", "pcs"], default: "pcs" }, // Unit of measurement
      // Quantity available
    },
    purchaseQuantity: { type: Number },
    profitMargin: { type: Number },
    taxValue: { type: Number, default: 0 },

    // Fields Specific to Tools
    toolCategory: { type: String }, // Category for tools
    toolDetails: {
      type: { type: String }, // Tool type (e.g., Testing, Cleaning)
      serialNumber: { type: String }, // Serial number
      condition: {
        type: String,
        enum: ["Good", "Maintenance Required", "Broken"],
        default: "Good",
      }, // Tool condition
      lastMaintenanceDate: { type: Date }, // Last maintenance date
    },


    warranty: { type: String },
    condition: { type: String, default: "new" },

    // START TOON ENHANCEMENTS (ITEM_MASTER)
    serviceAttributes: {
      isRepairPart: { type: Boolean, default: false },
      repairCategories: [{ type: String }],
      compatibleDevices: [{ type: String }],
      partGrade: {
        type: String,
        enum: ["oem", "oe", "premium", "standard", "economy"]
      },
      installationTime: { type: Number }, // minutes
      requiresCalibration: { type: Boolean, default: false }
    },

    stockTracking: {
      currentStock: { type: Number, default: 0 },
      reservedForRepairs: { type: Number, default: 0 },
      availableForSale: { type: Number, default: 0 },
      reorderPoint: { type: Number, default: 5 },
      preferredSupplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null }
    },

    pricing: {
      sellingPrice: { type: Number },
      priceHistory: [{
        effectiveDate: Date,
        costPrice: Number,
        sellingPrice: Number,
        purchaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase' }
      }]
    },
    // HIERARCHY FIELDS
    hasVariants: {
      type: Boolean,
      default: false
    },
    variantCount: {
      type: Number,
      default: 0
    },
    isLegacy: {
      type: Boolean,
      default: false
    },

    createdAt: { type: Date, default: Date.now }, // Creation timestamp
    updatedAt: { type: Date, default: Date.now }, // Update timestamp
  },
  { timestamps: true }
);

// Middleware to sync stockTracking with legacy fields if needed, or vice-versa
// For now, we rely on controllers to update both.

ItemSchema.pre('save', function (next) {
  if (this.isModified('itemName')) {
    this.itemName = this.itemName.toUpperCase();
  }
  next();
});

// Case-insensitive unique index for itemName
ItemSchema.index(
  { itemName: 1 },
  {
    unique: true,
    collation: { locale: 'en', strength: 2 }
  }
);

const Item = mongoose.model("Item", ItemSchema);
module.exports = Item
