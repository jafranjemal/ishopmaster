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
        trim: true,
        uppercase: true
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

attributeSchema.pre('save', function (next) {
    if (this.isModified('key')) {
        this.key = this.key.toUpperCase();
    }
    next();
});
module.exports = mongoose.model('Attribute', attributeSchema);
