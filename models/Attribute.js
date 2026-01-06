const mongoose = require('mongoose');

const attributeSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true
    },
    values: [{
        type: String,
        trim: true
    }],
    description: {
        type: String,
        trim: true
    },
    order: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Attribute', attributeSchema);
