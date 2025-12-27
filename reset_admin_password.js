require('dotenv').config();
const connectDB = require('./db/db');
const User = require('./models/User');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

async function resetAdminPassword() {
    try {
        await connectDB();
        console.log("Connected to DB...");

        // Find the admin user
        const adminUser = await User.findOne({ username: 'admin' });
        if (!adminUser) {
            console.log("Admin user not found");
            return;
        }

        console.log("Current admin user:", {
            username: adminUser.username,
            email: adminUser.email,
            isActive: adminUser.isActive,
            passwordHash: adminUser.password.substring(0, 20) + "..." // Show first 20 chars of hash
        });

        // Hash the correct password
        const correctPassword = 'password123';
        const hashedPassword = await bcrypt.hash(correctPassword, 10);

        // Update the password
        await User.findByIdAndUpdate(adminUser._id, { password: hashedPassword });

        console.log("Admin password has been reset to: password123");

        // Verify the password works
        const updatedUser = await User.findById(adminUser._id).select('+password');
        const isValid = await bcrypt.compare(correctPassword, updatedUser.password);
        console.log("Password verification:", isValid ? "SUCCESS" : "FAILED");

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected from DB");
    }
}

resetAdminPassword();
