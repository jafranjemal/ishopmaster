
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employees',
    required: true
  },
  roles: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role'
  }],

  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  directPermissions: [{
    permission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Permissions'
    },
    granted: {
      type: Boolean,
      default: true
    },
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    grantedAt: {
      type: Date,
      default: Date.now
    }
  }]

}, {
  timestamps: true
});

// Password hashing middleware
userSchema.pre('save', async function (next) {
  // Normalize username to lowercase
  if (this.isModified('username')) {
    this.username = this.username.toLowerCase();
  }

  // Hash password
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Methods for permission checking
userSchema.methods.hasRole = function (roleName) {
  return this.roles.some(role => role.name === roleName);
};

// Method to check user permissions
userSchema.methods.hasPermission = async function (module, action) {
  // Ensure roles and their permissions are populated
  const isRolesPopulated = this.populated('roles');
  const isPermissionsPopulated = this.roles && this.roles.length > 0 &&
    this.roles[0].permissions &&
    this.roles[0].permissions.length > 0 &&
    this.roles[0].permissions[0].module;

  if (!isRolesPopulated || !isPermissionsPopulated) {
    await this.populate({
      path: 'roles',
      populate: { path: 'permissions' }
    });
  }
  // Check direct permissions
  const directPermission = this.directPermissions.find(
    dp => dp.permission.module === module &&
      dp.permission.action === action
  );

  if (directPermission) return directPermission.granted;

  // Check role-based permissions

  return this.roles.some(role =>
    role.permissions?.some(p => p.module === module && p.actions.includes(action))
  );
};
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('users', userSchema);
module.exports = User;