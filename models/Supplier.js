const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    contactDetails: {
        phone: String,
        email: String,
        address: String,
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

module.exports = mongoose.model('Supplier', supplierSchema);

/**
 * 
 * {
    "_id": "64f0c1e89d84a01234abc789",
    "name": "TechWorld Suppliers",
    "contactDetails": {
        "phone": "1234567890",
        "email": "supplier@techworld.com",
        "address": "123 Tech Street, Silicon Valley"
    },
    "createdAt": "2024-08-01T12:00:00.000Z",
    "updatedAt": "2024-08-10T12:00:00.000Z"
}

 * 
 */
