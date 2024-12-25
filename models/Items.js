const mongoose = require("mongoose");

const ItemSchema = new mongoose.Schema(
  {
    // Common Fields for All Items
    itemName: { type: String, required: true, unique: true }, // Item Name
    itemImage: { type: String }, // Image URL
    units: { type: String,  default: "pcs" },  
    alertQuantity: { type: String,  default: "0" },  
    notForSelling: { type: Boolean,  default: false },  
    category: {
      type: String,
      required: true,
      enum: ["Device", "Accessory", "Spare Part", "Consumable", "Tool"],
    }, // Item Type
    itemDescription: { type: String }, // Optional description
    manufacturer: { type: String }, // Manufacturer name
    modelName: { type: String }, // Model name (if applicable)
    barcode: { type: String, unique: true }, // Unique barcode (if applicable)
     
    costPrice: { type: Number }, // Purchase cost for not selling items    
    purchaseDate: { type: Date },
     

    imei: {
        type: String,
        unique: true,
        validate: {
          validator: function (v) {
            // Only require IMEI if the category is 'Device'
            if (this.category === 'Device' && (!v || v.trim() === '')) {
              return false; // IMEI must not be null or empty for devices
            }
            return true; // Allow for non-devices or valid IMEI for devices
          },
          message: 'IMEI is required and cannot be empty for devices.',
        },
      },

    // Fields Specific to Devices
     
      deviceCategory: { type: String }, // RAM size
      deviceSubCategory: { type: String }, // RAM size
      ram: { type: String }, // RAM size
      storage: { type: String }, // Storage size
      displaySize: { type: String }, // Display size
      rearCamera: { type: String }, // Rear camera pixels
      frontCamera: { type: String }, // Front camera pixels
      fingerprint: { type: Boolean }, // Fingerprint availability
      networkType: { type: String }, // Supported networks (e.g., 4G, 5G)
      simType: { type: String }, // SIM type (e.g., Nano)
      batteryCapacity: { type: Number }, // Number of SIM slots
      batteryHealth: { type: Number }, // Number of SIM slots
      
    
    

    // Fields Specific to Accessories
    compatibility: [{ type: String }], // Compatible devices
    accessoryCategory: { type: String }, // Compatible devices
    

    // Fields Specific to Spare Parts
    sparePartDetails: {
      partNumber: { type: String }, // Part number for identification
      compatibleModels: [{ type: String }], // Compatible models
    },

    sparePartCategory: {type:String},

    // Fields Specific to Consumables
    consumableDetails: {
      usageUnit: { type: String, enum: ["ml", "g", "pcs"], default: "pcs" }, // Unit of measurement
       // Quantity available
    },
    purchaseQuantity: { type: Number },

    // Fields Specific to Tools
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


    warranty: {type:String},
    condition: {type:String},

    createdAt: { type: Date, default: Date.now }, // Creation timestamp
    updatedAt: { type: Date, default: Date.now }, // Update timestamp
  },
  { timestamps: true }
);

module.exports = mongoose.model("Item", ItemSchema);
