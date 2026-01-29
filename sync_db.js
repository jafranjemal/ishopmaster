const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { seedPermissionsAndRoles } = require('./seeders/roleSeeder');

dotenv.config();

//const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ishop';
const localUri = 'mongodb://localhost:27017/ishopmaster_new_test_db'

async function syncDatabase() {
    try {
        console.log('--- ERP Database Sync Starting ---');
        await mongoose.connect(localUri);
        console.log('Connected to MongoDB.');

        console.log('Running Permission & Role Seeder...');
        await seedPermissionsAndRoles();

        console.log('--- Sync Completed Successfully ---');
        process.exit(0);
    } catch (error) {
        console.error('--- Sync Failed ---');
        console.error(error);
        process.exit(1);
    }
}

syncDatabase();
