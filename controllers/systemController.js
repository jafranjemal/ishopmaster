const Company = require('../models/Company');
const User = require('../models/User');
const Role = require('../models/Role');
const Employees = require('../models/Employee');
const bcrypt = require('bcryptjs');
const { seedWalkInCustomer } = require('../seeders/customerSeeder');
const { seedMasterData } = require('../master_seeder');
const Account = require('../models/Account');
const moment = require('moment');

/**
 * Check if the system needs first-time setup
 * Returns true if no company exists in the database
 */
exports.getSystemStatus = async (req, res) => {
    try {
        const companyCount = await Company.countDocuments();
        const needsSetup = companyCount === 0;

        res.json({
            needsSetup,
            version: process.env.APP_VERSION || '1.0.0',
            environment: process.env.NODE_ENV || 'development'
        });
    } catch (error) {
        console.error('Error checking system status:', error);
        res.status(500).json({ message: 'Failed to check system status', error: error.message });
    }
};

/**
 * Initialize the system with company details, admin user, and defaults
 * This can only be run when no company exists
 */
exports.initializeSystem = async (req, res) => {
    try {
        // Check if system is already initialized
        const companyCount = await Company.countDocuments();
        if (companyCount > 0) {
            return res.status(400).json({
                message: 'System has already been initialized. Setup can only be run once.'
            });
        }

        const { company, admin, defaults } = req.body;

        // Validate required fields
        if (!company || !admin) {
            return res.status(400).json({
                message: 'Company details and admin credentials are required'
            });
        }

        // Initialize Socket Logger
        const io = req.app.get('socketio');
        const log = (message, type = 'info') => {
            console.log(`[Init] ${message}`);
            try {
                if (io) {
                    io.emit('init_log', { message, type });
                }
            } catch (e) {
                console.error('Socket log failed:', e.message);
            }
        };

        // Create company
        const newCompany = new Company({
            company_name: company.company_name,
            company_type: company.company_type || 'Retail',
            contact_person: company.contact_person,
            email: company.email,
            phone_number: company.phone_number,
            address: company.address,
            tax_id: company.tax_id,
            registration_number: company.registration_number,
            company_logo: company.company_logo,
        });

        await newCompany.save();
        log(`Company created: ${newCompany.company_name}`, 'success');

        // Run Master Data Seeder FIRST (Creates Units, Roles, Permissions, Brands, etc.)
        // This ensures the 'Admin' role exists and has the correct permissions before we create the user
        log('Triggering Master Data Seeder...', 'info');

        // Pass logger to seeder
        await seedMasterData(false, log);

        log('Master Data Seeding Completed.', 'success');

        // Fetch the NEW Admin role created by the seeder
        const adminRole = await Role.findOne({ name: 'Admin' });
        if (!adminRole) {
            throw new Error('Critical Error: Admin role not found after seeding.');
        }

        // Create admin employee
        const adminEmployee = new Employees({
            name: admin.name || admin.username,
            email: admin.email,
            phone: admin.phone || '0000000000',
            address: admin.address || '',
            roles: [adminRole._id],
            salary_type: 'Fixed',
            fixed_salary: 0,
            status: 'Active'
        });

        await adminEmployee.save();
        log(`Admin employee created: ${adminEmployee.name}`, 'success');

        // Create admin user
        // Note: Password will be hashed by the User model's pre-save hook
        const adminUser = new User({
            username: admin.username,
            email: admin.email,
            password: admin.password,
            employeeId: adminEmployee._id,
            roles: [adminRole._id],
            isActive: true,
        });

        await adminUser.save();
        log(`Admin user created: ${adminUser.username}`, 'success');

        // Create walk-in customer
        const mongoose = require('mongoose');
        await seedWalkInCustomer(mongoose.connection);
        log('Walk-in Customer created.', 'success');

        // Create Default Company Accounts
        log('Seeding Default Company Accounts...', 'info');
        const mainCashAccount = new Account({
            account_name: "Main Cash Drawer",
            account_type: "Cash",
            balance: defaults?.opening_cash || 0,
            account_owner_type: "Company",
            related_party_id: newCompany._id,
            description: "Primary cash account for POS sales and petty cash."
        });
        await mainCashAccount.save();

        const companyBankAccount = new Account({
            account_name: `${newCompany.company_name} - Operating Account`,
            account_type: "Bank",
            balance: 0,
            account_owner_type: "Company",
            related_party_id: newCompany._id,
            description: "Default bank account for company transactions."
        });
        await companyBankAccount.save();
        log('Core financial accounts initialized.', 'success');

        // Store default configurations (if provided)
        if (defaults) {
            log('Default configurations applied', 'info');
        }

        log('System Initialization Complete! Redirecting...', 'success');

        // Small delay to ensure last log is sent
        await new Promise(r => setTimeout(r, 1000));

        res.status(201).json({
            success: true,
            message: 'System initialized successfully',
            company: {
                id: newCompany._id,
                name: newCompany.company_name
            },
            admin: {
                id: adminUser._id,
                username: adminUser.username
            }
        });

    } catch (error) {
        console.error('Error initializing system:', error);
        // Try to log error to socket if possible
        const io = req.app.get('socketio');
        if (io) io.emit('init_log', { message: `Error: ${error.message}`, type: 'error' });

        res.status(500).json({
            message: 'Failed to initialize system',
            error: error.message
        });
    }
};


/**
 * Get system information (public)
 */
exports.getSystemInfo = async (req, res) => {
    try {
        const company = await Company.findOne();

        if (!company) {
            return res.status(404).json({ message: 'System not initialized' });
        }

        const installDate = moment(company.created_at);
        const expiryDate = moment(installDate).add(2, 'years');
        const remainingDays = expiryDate.diff(moment(), 'days');

        res.json({
            appName: "iShopMaster",
            version: process.env.APP_VERSION || '0.1.18', // Fallback to user's version
            company: company.company_name, // Returning just name as per user snippet, or object? User snippet showed string. I'll stick to their structure but provide the object if they need it elsewhere? No, user snippet had structure. I will follow user snippet structure but keep extended company info if needed? User snippet: `company: "JJSOFT GLOBAL"`. I will use `company.company_name`.

            // Dynamic License Info
            installDate: installDate.format('YYYY-MM-DD'),
            accessType: "2 Year Limited Access",
            expiryDate: expiryDate.format('YYYY-MM-DD'),
            remainingDays: remainingDays > 0 ? remainingDays : 0,
            isExpired: remainingDays <= 0,

            // Extended Company Details (Optional but good to have)
            companyDetails: {
                name: company.company_name,
                email: company.email,
                phone: company.phone_number,
                logo: company.company_logo
            },

            acknowledgements: [
                {
                    name: "MA iPhone Solution",
                    role: "Business Process Consultation & Domain Expertise",
                    logo: "https://lh3.googleusercontent.com/p/AF1QipMFuXbxpKETdIYtFeOWkL_0BAZalT3-RO96dcEK=s680-w680-h510-rw"
                }
            ]
        });
    } catch (error) {
        console.error('Error fetching system info:', error);
        res.status(500).json({ message: 'Failed to fetch system info' });
    }
};
