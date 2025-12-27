require('dotenv').config();
const connectDB = require('./db/db');
const systemController = require('./controllers/systemController');
const mongoose = require('mongoose');

// Mock Request/Response for system initialization
const req = {
    body: {
        company: {
            company_name: 'I Zone Mobile',
            company_type: 'Retail',
            contact_person: 'Admin',
            email: 'admin@izone.com',
            phone_number: '1234567890',
            address: 'Test Address',
            tax_id: '123456',
            registration_number: 'REG123'
        },
        admin: {
            username: 'admin',
            email: 'admin@izone.com',
            password: 'password123',
            name: 'System Admin',
            phone: '1234567890',
            address: 'Test Address'
        }
    }
};

const res = {
    status: function (code) {
        this.statusCode = code;
        return this;
    },
    json: function (data) {
        console.log("Status Code:", this.statusCode);
        if (this.statusCode === 201) {
            console.log("Success: System initialized successfully");
            console.log("Response:", JSON.stringify(data, null, 2));
        } else {
            console.error("Error Response:", JSON.stringify(data, null, 2));
        }
    }
};

async function run() {
    await connectDB();
    console.log("Connected to DB, initializing system...");
    try {
        await systemController.initializeSystem(req, res);
    } catch (err) {
        console.error("Unhandled Error:", err);
    } finally {
        setTimeout(async () => {
            await mongoose.disconnect();
            console.log("Disconnected");
            process.exit(0);
        }, 2000);
    }
}

run();
