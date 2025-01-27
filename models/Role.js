const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        enum: ['Admin', 'Sales', 'Manager', 'Cashier', 'Support', 'Receptionist', 'Technician']
      },
    permissions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Permissions'
    }],
    description: String,
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Method to check if role has specific permission
roleSchema.methods.hasPermission = function(permissionName) {
    return this.permissions.some(p => p.name === permissionName);
  };
const Role = mongoose.model('Role', roleSchema);
module.exports = Role;