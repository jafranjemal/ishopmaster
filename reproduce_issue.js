require('dotenv').config();
const connectDB = require('./db/db');
const customerController = require('./controllers/customerController');
const mongoose = require('mongoose');

// Mock Request/Response
const req = {
    query: {
        page: 1,
        limit: 10,
        search: "",
        sortBy: "created_at",
        sortOrder: "desc"
    }
};

const res = {
    status: function (code) {
        this.statusCode = code;
        return this;
    },
    json: function (data) {
        console.log("Status Code:", this.statusCode);
        if (this.statusCode === 200) {
            console.log("Success: Data fetched successfully");
            // console.log("Success:", JSON.stringify(data, null, 2));
        } else {
            console.error("Error Response:", JSON.stringify(data, null, 2));
        }
    }
};

async function run() {
    await connectDB();
    console.log("Connected to DB, running controller...");
    try {
        await customerController.getCustomersAndAccounts(req, res);
    } catch (err) {
        console.error("Unhandle Error:", err);
    } finally {
        setTimeout(async () => {
            await mongoose.disconnect();
            console.log("Disconnected");
            process.exit(0);
        }, 2000);
    }
}

run();
