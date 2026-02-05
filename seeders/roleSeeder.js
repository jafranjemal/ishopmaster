const Role = require('../models/Role');
const mongoose = require('mongoose');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const Permissions = require('../models/Permissions');
const PermissionService = require('../services/PermissionService');
const Company = require('../models/Company');

const defaultCompanyData = {
  company_name: 'iShop Master',
  company_type: 'Retail',
  contact_person: 'John Doe',
  email: 'contact@ishopmaster.com',
  phone_number: '+1234567890',
  address: '123 Main Street, City, Country',
  tax_id: 'TAX123456',
  registration_number: 'REG123456',
  isActive: true
};

const seedDefaultCompany = async () => {
  try {
    // Check if a company already exists
    await Company.deleteMany({});



    // Create default company
    const newCompany = new Company(defaultCompanyData);
    await newCompany.save();

    console.log('Default company seeded successfully');
  } catch (error) {
    console.error('Error seeding default company:', error);
    throw new ApiError(500, 'Error seeding default company: ' + error.message);
  }
};


const modulePermissions = {
  dashboard: ['view'],
  customers: ['view', 'create', 'edit', 'delete', 'export'],
  employee: ['view', 'create', 'edit', 'delete', 'export'],
  items: ['view', 'create', 'edit', 'delete', 'export'],
  payments: ['view', 'create'],
  pos: ['view', 'create'],
  purchase: ['view', 'create', 'edit', 'delete'],
  repair: ['view', 'create', 'edit'],
  sales: ['view', 'create', 'edit', 'delete', 'export'],
  stock: ['view', 'create', 'edit'],
  suppliers: ['view', 'create', 'edit', 'delete'],
  users: ['view', 'create', 'edit', 'delete'],
  settings: ['view', 'create', 'edit', 'delete'],
  intelligence: ['view', 'view_sensitive'],
  barcode: ['view', 'edit'],
  units: ['view', 'create', 'edit', 'delete'],
  companyAccount: ['view'],
  customersAccount: ['view'],
  supplierAccount: ['view'],
  employeeAccount: ['view']
};

// Define role permissions mapping
const rolePermissionsMap = {
  Admin: Object.keys(modulePermissions),
  Manager: [
    'dashboard', 'customers', 'employee', 'items', 'payments', 'pos',
    'purchase', 'repair', 'sales', 'stock', 'suppliers', 'intelligence',
    'barcode', 'units', 'companyAccount', 'customersAccount',
    'supplierAccount', 'employeeAccount', 'shift', 'transactions'
  ],
  Sales: [
    'pos', 'customers', 'sales', 'items', 'payments', 'shift',
    'transactions', 'companyAccount', 'customersAccount'
  ],
  Cashier: ['pos', 'payments', 'shift', 'companyAccount'],
  Support: ['customers', 'repair'],
  Receptionist: ['customers', 'repair', 'sales'],
  Technician: ['repair', 'stock', 'items']
};

const roleSeeds = [
  {
    name: 'Admin',
    description: 'System Administrator with full access',
    permissions: [], // Will be populated with all permissions
    isActive: true
  },
  {
    name: 'Manager',
    description: 'Store Manager with comprehensive operational access',
    permissions: [],
    isActive: true
  },
  {
    name: 'Sales',
    description: 'Sales staff with access to POS, Payments, and Shifts',
    permissions: [],
    isActive: true
  },
  {
    name: 'Cashier',
    description: 'Cashier with access to POS, Payments, and Shifts',
    permissions: [],
    isActive: true
  },
  {
    name: 'Support',
    description: 'Support staff with customer service access',
    permissions: [],
    isActive: true
  },
  {
    name: 'Receptionist',
    description: 'Front desk staff with basic sales and repair access',
    permissions: [],
    isActive: true
  },
  {
    name: 'Technician',
    description: 'Repair technician with repair module access',
    permissions: [],
    isActive: true
  }
];

// Role name mapping
const ROLE_NAMES = {
  'admin': 'Admin',
  'manager': 'Manager',
  'sales': 'Sales',
  'cashier': 'Cashier',
  'support': 'Support',
  'receptionist': 'Receptionist',
  'technician': 'Technician'
};

const seedRoles = async () => {
  try {
    await Role.deleteMany({});
    await Role.insertMany(roleSeeds);
    console.log('Roles seeded successfully');
  } catch (error) {
    console.error('Error seeding roles:', error);
  }
};

function shouldHaveAccess(roleName, module) {
  return rolePermissionsMap[roleName]?.includes(module) ?? false;
}

const seedPermissionsAndRoles = async () => {
  try {
    console.log('Synchronizing Roles and Permissions...');

    // 1. Sync Roles (Upsert by name to preserve IDs)
    const roles = [];
    for (const roleName of Object.values(ROLE_NAMES)) {
      const role = await Role.findOneAndUpdate(
        { name: roleName },
        {
          $set: {
            name: roleName,
            isActive: true,
            description: `${roleName} role with standard permissions`
          }
        },
        { upsert: true, new: true }
      );
      roles.push(role);
    }

    // 2. Clear all existing permissions (since we are rebuilding the matrix)
    // We link them by roleId, so this is safe as long as we re-assign them to roles.
    await Permissions.deleteMany({});

    // 3. Create and assign permissions for each role
    for (const role of roles) {
      const roleModules = Object.entries(modulePermissions)
        .filter(([module]) => shouldHaveAccess(role.name, module));

      const permissionsToCreate = roleModules.map(([module, actions]) => ({
        module,
        actions,
        isActive: true,
        roleId: role._id, // String or ObjectId depending on model
        name: `${module}_${actions.join('_')}`.toUpperCase()
      }));

      const createdPermissions = await Permissions.create(permissionsToCreate);

      await Role.findByIdAndUpdate(
        role._id,
        { $set: { permissions: createdPermissions.map(p => p._id) } }
      );

      // 4. Proactively ensure existing users with this role name have the correct ObjectID
      // This fixes cases where roles were previously deleted and recreated.
      await User.updateMany(
        { username: role.name.toLowerCase() }, // Assuming username matches role for default users
        { $set: { roles: [role._id] } }
      );

      // Also update any user who should have this role but might have an old ID
      // This is a bit aggressive but helps recovery.
      // For now, let's just ensure the 'Admin' user is linked to the 'Admin' role.
      if (role.name === 'Admin') {
        await User.updateOne({ username: 'admin' }, { $set: { roles: [role._id] } });
      }
    }

    console.log('Permissions and Roles synchronized successfully');
  } catch (error) {
    console.error('Synchronization failed:', error);
    throw error;
  }
};


const defaultPassword = 'password123';

const userSeeds = [
  {
    username: 'admin',
    email: 'admin@ishopmaster.com',
    password: defaultPassword,
    employeeId: new mongoose.Types.ObjectId(), // Will be updated with real employee
    roles: [], // Will be populated with Admin role
    isActive: true
  },
  {
    username: 'manager',
    email: 'manager@ishopmaster.com',
    password: defaultPassword,
    employeeId: new mongoose.Types.ObjectId(),
    roles: [], // Will be populated with Manager role
    isActive: true
  },
  {
    username: 'sales1',
    email: 'sales1@ishopmaster.com',
    password: defaultPassword,
    employeeId: new mongoose.Types.ObjectId(),
    roles: [], // Will be populated with Sales role
    isActive: true
  },
  {
    username: 'cashier1',
    email: 'cashier1@ishopmaster.com',
    password: defaultPassword,
    employeeId: new mongoose.Types.ObjectId(),
    roles: [], // Will be populated with Cashier role
    isActive: true
  },
  {
    username: 'support1',
    email: 'support1@ishopmaster.com',
    password: defaultPassword,
    employeeId: new mongoose.Types.ObjectId(),
    roles: [], // Will be populated with Support role
    isActive: true
  },
  {
    username: 'receptionist1',
    email: 'receptionist1@ishopmaster.com',
    password: defaultPassword,
    employeeId: new mongoose.Types.ObjectId(),
    roles: [], // Will be populated with Receptionist role
    isActive: true
  },
  {
    username: 'technician1',
    email: 'technician1@ishopmaster.com',
    password: defaultPassword,
    employeeId: new mongoose.Types.ObjectId(),
    roles: [], // Will be populated with Technician role
    isActive: true
  }
];

const seedUsers = async () => {
  try {
    // Get roles

    const roles = await Role.find();
    const roleMap = roles.reduce((acc, role) => {
      acc[role.name] = role._id;
      return acc;
    }, {});

    // Hash passwords and assign roles
    const users = await Promise.all(
      userSeeds.map(async (user) => {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        const roleName = user.username === 'admin' ?
          ROLE_NAMES['admin'] :
          ROLE_NAMES[user.username.split('1')[0]];
        if (!roleMap[roleName]) {
          throw new Error(`Role not found: ${roleName}`);
        }
        return {
          ...user,
          password: hashedPassword,
          roles: [roleMap[roleName]]
        };
      })
    );

    // Delete existing users and insert new ones
    await User.deleteMany({});
    await User.insertMany(users);

    console.log('Users seeded successfully');
  } catch (error) {
    console.error('Error seeding users:', error);
  }
};




module.exports = { seedDefaultCompany, seedPermissionsAndRoles, seedRoles, roleSeeds, seedUsers, userSeeds };