const mongoose = require('mongoose');
require('dotenv').config();
const Shift = require('../models/Shift');
const User = require('../models/User');

const fixShifts = async () => {
    try {
        // Use the same database URI as the main application
        const localUri = 'mongodb://localhost:27017/ishopmaster';
        const mongoUri = 'mongodb+srv://jafranjemal:jafran123@cluster0.yai9p.mongodb.net/ishopmaster?retryWrites=true&w=majority';
        const MONGODB_URI = process.env.NODE_ENV !== 'production' ? mongoUri : localUri;

        await mongoose.connect(MONGODB_URI);

        console.log('Connected to DB');

        const shifts = await Shift.find({});
        console.log(`Found ${shifts.length} shifts. Checking for orphans...`);

        const admin = await User.findOne({}); // Just get any user, pref admin
        // Ideally filter by role, but any user works to fix the 'Unknown'

        if (!admin) {
            console.log("No users found in DB! Cannot reassign.");
            process.exit(1);
        }
        console.log(`Using fallback User: ${admin.username} (${admin._id})`);

        let updated = 0;
        for (const shift of shifts) {
            const userExists = await User.exists({ _id: shift.userId });
            if (!userExists) {
                console.log(`Shift ${shift._id} has missing user ${shift.userId}. Reassigning...`);
                shift.userId = admin._id;
                shift.notes = (shift.notes || "") + " [System: Reassigned from missing user]";
                await shift.save();
                updated++;
            }
        }

        console.log(`Fixed ${updated} orphaned shifts.`);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

fixShifts();
