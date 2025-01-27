const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  name: {
    type: String,
    
  },
  roleId: {
    type: String,
    
  },
   
    module: {
      type: String,
      required: true,
      // enum: [
      //   'customers', 
      //   'dashboard',
      //   'employee',
      //   'items',
      //   'payments',
      //   'pos',
      //   'purchase',
      //   'repair',
      //   'sales',
      //   'shift',
      //   'stock',
      //   'suppliers',
      //   'transactions',
      //   'units',
      //   'users'
      // ]
    },
    actions: [{
      type: String,
      enum: ['view', 'create', 'edit', 'delete', 'export'],
      required: true
    }]
  ,
  description: String,
  isActive: {
    type: Boolean,
    default: true
  }
  
}, {
  timestamps: true});

  // Compound index for unique module-action combinations
//permissionSchema.index({ module: 1, action: 1 }, { unique: true });


async function generatePermissionName(module, actions) {
  // Format module name (uppercase first letter)
  const formattedModule = module.toLowerCase();
  
  // Format actions (uppercase)
  const formattedActions = actions
    .map(action => action.toUpperCase())
    .sort()
    .join('_');

  // Generate unique permission name
  return `${formattedModule}_${formattedActions}`;
}


permissionSchema.pre('save', async function(next) {
  try {
    if (!this.isModified('module') && !this.isModified('actions')) {
      return next();
    }

    // Validate required fields
    if (!this.module || !this.actions || !this.actions.length) {
      throw new Error('Module and actions are required');
    }

    // Generate unique name
    this.name = await generatePermissionName(this.module, this.actions);
    console.log('Generated permission name:', this.name);
    next();
  } catch (error) {
    next(error);
  }
});

const Permissions = mongoose.model('Permissions', permissionSchema);
module.exports = Permissions;