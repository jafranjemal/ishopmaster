require('dotenv').config();
const mongoose = require('mongoose');
const Unit = require('./models/Unit');
const Role = require('./models/Role');
const Permissions = require('./models/Permissions');
const BarcodeSettings = require('./models/BarcodeSettings');
const Brand = require('./models/Brand');
const PhoneModel = require('./models/PhoneModel');
const Item = require('./models/Items');

const MONGO_URI = process.env.NODE_ENV === 'production' ? process.env.PROD_URI : process.env.LOCAL_URI;

function getPhoneImageUrl(brand, modelName) {
  const normalizedBrand = brand.toLowerCase();
  const cleanModel = modelName.replace(/pro|max|plus|ultra/gi, '').trim();

  // Unsplash (realistic + stable)
  const unsplashQuery = `${normalizedBrand} ${cleanModel} smartphone`;
  const unsplashUrl = `https://source.unsplash.com/400x800/?${encodeURIComponent(unsplashQuery)}`;

  // Guaranteed fallback
  const placeholderUrl = `https://picsum.photos/seed/${encodeURIComponent(
    normalizedBrand + '-' + cleanModel
  )}/400/800`;

  return unsplashUrl || placeholderUrl;
}


const seedMasterData = async (isScript = false, logCallback = null) => {
  let unitsArr = [];
  let rolesArr = [];
  let brandsArr = [];
  let modelsArr = [];
  let itemDocs = [];
  let finalPermissionsCount = 0;
  let finalModulesCount = 0;

  let isLogging = false;
  const log = (message, type = 'info') => {
    if (isLogging) return;
    isLogging = true;
    try {
      console.log(message);
      if (logCallback && typeof logCallback === 'function') {
        logCallback(message, type);
      }
    } catch (e) {
      console.error('Logger internal error:', e.message);
    } finally {
      isLogging = false;
    }
  };

  let session = null;
  try {
    if (isScript) {
      await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
      log('Connected to MongoDB...', 'success');
    }

    session = await mongoose.startSession();
    session.startTransaction();
    log('Transaction Started...', 'info');

    // 1. Units
    log('Seeding Units...', 'warning');
    await Unit.deleteMany({}).session(session);
    unitsArr = [
      { name: 'Piece', symbol: 'pc' },
      { name: 'Box', symbol: 'box' },
      { name: 'Pack', symbol: 'pack' }
    ];
    await Unit.insertMany(unitsArr, { session });

    // 2. Roles
    log('Seeding Roles...', 'warning');
    await Role.deleteMany({}).session(session);
    const rolesData = [
      { name: 'Admin', description: 'Full access', isActive: true },
      { name: 'Manager', description: 'Management access', isActive: true },
      { name: 'Sales', description: 'POS access', isActive: true },
      { name: 'Technician', description: 'Repair access', isActive: true }
    ];
    rolesArr = await Role.insertMany(rolesData, { session });

    // 3. Permissions
    log('Seeding Permissions...', 'info');
    await Permissions.deleteMany({}).session(session);

    // Full module list from PermissionConstants.js (Crucial for UI Menus)
    const allModules = [
      'dashboard', 'customers', 'employee', 'items', 'payments', 'pos', 'purchase', 'repair', 'sales',
      'shift', 'stock', 'supplier', 'transactions', 'units', 'users', 'settings', 'barcode',
      'companyAccount', 'employeeAccount', 'supplierAccount', 'customersAccount'
    ];

    const rolePermissionMap = {
      Admin: allModules,
      Manager: ['dashboard', 'customers', 'employee', 'items', 'pos', 'purchase', 'repair', 'sales', 'stock', 'supplier', 'transactions', 'units', 'settings', 'barcode'],
      Sales: ['pos', 'customers', 'sales', 'items'],
      Technician: ['repair', 'stock', 'items']
    };
    const actions = ['view', 'create', 'edit', 'delete', 'export'];
    const sortedActions = [...actions].map(a => a.toUpperCase()).sort().join('_');

    const totalPermissions = [];
    const roleUpdates = [];

    for (const role of rolesArr) {
      const allowed = rolePermissionMap[role.name] || [];
      if (allowed.length === 0) continue;
      const perms = allowed.map(mod => ({ module: mod, actions, roleId: role._id, name: `${mod.toLowerCase()}_${sortedActions}`, isActive: true }));
      const created = await Permissions.insertMany(perms, { session });
      totalPermissions.push(...created);
      roleUpdates.push({ updateOne: { filter: { _id: role._id }, update: { $set: { permissions: created.map(p => p._id) } } } });
    }
    if (roleUpdates.length > 0) await Role.bulkWrite(roleUpdates, { session });
    finalPermissionsCount = totalPermissions.length;

    // 5. Barcode
    await BarcodeSettings.deleteMany({}).session(session);
    await BarcodeSettings.create([{ settingName: 'Default', bcid: 'code128', scale: 3, height: 20, isActive: true }], { session });

    // 6. Brands
    log('Seeding Brands...', 'warning');
    await Brand.deleteMany({}).session(session);
    const brandsData = ['Apple', 'Samsung', 'Xiaomi', 'Oppo', 'Vivo', 'Huawei'].map(name => ({ name }));
    brandsArr = await Brand.insertMany(brandsData, { session });

    // 7. Models & Items
    log('Seeding Models & Real items...', 'warning');
    await PhoneModel.deleteMany({}).session(session);
    await Item.deleteMany({}).session(session);

    const { DEVICE_SPECS, getModelsList } = require('./data/DeviceMasterData');
    const deviceSpecs = DEVICE_SPECS;
    const modelsData = getModelsList();

    const modelDocs = [];
    const itemsToSeed = [];

    for (const modelDef of modelsData) {
      const brandDoc = brandsArr.find(b => b.name === modelDef.brand);
      if (!brandDoc) continue;

      modelDocs.push({
        model_name: modelDef.name,
        brandId: brandDoc._id,
        colors: deviceSpecs[modelDef.name].colors,
        description: `Specs: ${JSON.stringify(deviceSpecs[modelDef.name])}`
      });
    }

    // Insert Phone Models FIRST to get IDs
    modelsArr = await PhoneModel.insertMany(modelDocs, { session });
    log(`Seeded ${modelsArr.length} phone models with colors.`, 'success');

    // Create Items using the inserted models
    for (const modelDoc of modelsArr) {
      // Look up original specs using the name
      const specs = deviceSpecs[modelDoc.model_name];
      const brandDoc = brandsArr.find(b => b._id.toString() === modelDoc.brandId.toString());

      // Determine brand name (fallback to Apple if logic fails, but current logic is hardcoded Apple)
      const brandName = brandDoc ? brandDoc.name : 'APPLE';

      const img = getPhoneImageUrl(brandName, modelDoc.model_name);

      itemsToSeed.push({
        itemName: `${brandName} ${modelDoc.model_name}`.toUpperCase(),
        itemImage: img,
        category: 'Device',
        manufacturer: brandName,
        phoneModelId: modelDoc._id, // LINKED!
        modelName: modelDoc.model_name, // Fallback/Cache
        units: 'Piece',
        barcode: `BAR-${Math.random().toString(36).substring(7).toUpperCase()}`,
        sku: `SKU-${Math.random().toString(36).substring(7).toUpperCase()}`,
        serialized: true,
        ramSize: specs?.ram || '',
        storageSize: specs?.storage || '',
        displaySize: specs?.display || '',
        batteryCapacity: specs?.batt || 0
      });
    }

    itemDocs = await Item.insertMany(itemsToSeed, { session });
    log(`Seeded ${itemDocs.length} real devices.`, 'success');

    await session.commitTransaction();
    session.endSession();
    if (isScript) await mongoose.disconnect();
    return true;
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
    if (session) { await session.abortTransaction(); session.endSession(); }
    if (isScript) await mongoose.disconnect();
    throw error;
  }
};

if (require.main === module) seedMasterData(true);
module.exports = { seedMasterData };
