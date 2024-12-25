const mongoose = require('mongoose');

// Schema for individual batches
const batchSchema = new mongoose.Schema({
    batchId: {
        type: mongoose.Schema.Types.ObjectId,
        default: new mongoose.Types.ObjectId(),
    },
    supplier: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier', // Assuming you have a separate Supplier model
        required: true,
    },
    purchasePrice: {
        type: Number,
        required: true,
    },
    sellingPrice: {
        type: Number,
        required: true,
    },
    units: {
        type: Number,
        required: true,
    },
    remainingUnits: {
        type: Number,
        required: true,
    },
    purchaseDate: {
        type: Date,
        default: Date.now,
    },
});

// Schema for the product
const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    brand: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        default: '',
    },
    batches: [batchSchema], // Embedded batches
    currentStock: {
        type: Number,
        default: 0,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

// Middleware to auto-update timestamps
productSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Product', productSchema);


/*

{
    "_id": "64f0c1e89d84a01234abc123",
    "name": "iPhone 14 Pro Max",
    "brand": "Apple",
    "category": "Mobile Phones",
    "description": "128GB Storage, Space Black",
    "batches": [
        {
            "batchId": "64f0c1e89d84a01234abc124",
            "supplier": "64f0c1e89d84a01234abc789",
            "purchasePrice": 1200,
            "sellingPrice": 1500,
            "units": 10,
            "remainingUnits": 8,
            "purchaseDate": "2024-08-10"
        },
        {
            "batchId": "64f0c1e89d84a01234abc125",
            "supplier": "64f0c1e89d84a01234abc790",
            "purchasePrice": 1250,
            "sellingPrice": 1600,
            "units": 5,
            "remainingUnits": 5,
            "purchaseDate": "2024-08-12"
        }
    ],
    "currentStock": 13,
    "createdAt": "2024-08-10T12:00:00.000Z",
    "updatedAt": "2024-08-12T15:00:00.000Z"
}


*/
