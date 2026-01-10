const mongoose = require('mongoose');
const { Schema } = mongoose;

// Service Item Schema
const serviceItemSchema = new Schema(
  {
    name: {
      type: String,
      required: true, // General name of the service (e.g., "Display Replacement")
    },
    description: {
      type: String,
      required: true, // Detailed description of the service
    },
    icon: {
      type: String,
      required: true, // Detailed description of the service
    },
    brand: {
      type: Schema.Types.ObjectId,
      ref: "Brand", // Reference to Brand model (Apple, Samsung, etc.)
      required: true,
    },
    modelVariants: [
      {
        modelId: {
          type: Schema.Types.ObjectId,
          ref: "PhoneModel", // Reference to PhoneModel schema
          required: true,
        },
        modelName: {
          type: String,
          required: true, // Model name (e.g., "iPhone 14 Pro Max")
        },
        warranty: {
          type: Number,
          default: 0, // Model name (e.g., "iPhone 14 Pro Max")
        },
        warrantyUnit: {
          type: String,
          default: "Days", // Model name (e.g., "iPhone 14 Pro Max")
        },
        price: {
          type: Number,
          required: true, // Price for this model-specific service
        },
        total: {
          type: Number,
          required: true, // final price model-specific service
        },
        duration: {
          type: String,
          required: true, // Duration for this model (e.g., "2 hours")
        },
        laborCharge: {
          type: Number,
          required: true, // Labor charge specific to this model
        },
        commission: {
          type: Number,
          required: false, // Labor charge specific to this model
        },
        discount: {
          type: Number,
          required: false, // Labor charge specific to this model
        },

        associatedParts: [
          {
            partId: {
              type: String,
              // Part required (e.g., "Display", "Adhesive")
            },
            partName: {
              type: String,
              // Part required (e.g., "Display", "Adhesive")
            },
            partCost: {
              type: Number,
              // Cost of the part
            },
            quantity: {
              type: Number,
              // Quantity needed
            },
            serialNumbers: { type: [String], required: false }, // Array of serial numbers if applicable
            isSerialized: { type: Boolean, default: false }, // Flag to indicate if the item is serialized
          },
        ],
      },
    ],
    category: {
      type: String,
      required: true, // Type of service (e.g., "Phone Repair", "Tablet Repair")
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active", // Status of the service
    },

    // START TOON ENHANCEMENTS (SERVICE_ITEM_MASTER)
    internalConfig: {
      serviceType: {
        type: String,
        enum: ["hardware_repair", "software_service", "diagnostic", "cleaning"],
        default: "hardware_repair"
      },
      requiresParts: { type: Boolean, default: true },
      requiresTechnician: { type: Boolean, default: true },
      skillLevel: {
        type: String,
        enum: ["beginner", "intermediate", "advanced", "expert"],
        default: "intermediate"
      },
      isHighRisk: { type: Boolean, default: false },
      estimatedTime: { type: Number }, // minutes

      workflow: {
        steps: [{ type: String }],
        qualityChecks: [{ type: String }],
        photosRequired: { type: Boolean, default: true }
      }
    },

    customerFacing: {
      displayName: { type: String },
      description: { type: String },
      includes: [{ type: String }],
      excludes: [{ type: String }],
      warrantyMonths: { type: Number, default: 3 }
    }
    // END TOON ENHANCEMENTS
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt timestamps
  }
);

serviceItemSchema.virtual('priceRange').get(function () {
  if (!this.modelVariants || this.modelVariants.length === 0) {
    return 'N/A';
  }

  const prices = this.modelVariants.map(variant => variant.total);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  return minPrice === maxPrice ? `${Number(minPrice).toLocaleString()}` : `${Number(minPrice).toLocaleString()} - ${Number(maxPrice).toLocaleString(0)}`;
});

module.exports = mongoose.model("ServiceItem", serviceItemSchema);
