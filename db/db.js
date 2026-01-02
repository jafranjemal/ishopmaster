const mongoose = require('mongoose');

// module.exports = {
//     mongoURI: 'mongodb+srv://jafranjemal:jafran123@cluster0.yai9p.mongodb.net/shimla-gem?retryWrites=true&w=majority'
//     ,secretOrKey:'secrect'
// };

const localUri = 'mongodb://localhost:27017/ishopmaster'
const mongoUri = 'mongodb+srv://jafranjemal:jafran123@cluster0.yai9p.mongodb.net/ishopmaster?retryWrites=true&w=majority'
const ishopmaster_izone_mobile = 'mongodb+srv://jafranjemal:jafran123@cluster0.yai9p.mongodb.net/ishopmaster-izone-mobile?retryWrites=true&w=majority'
const dbUri = process.env.NODE_ENV === 'production' ? mongoUri : localUri;

const connectDB = async () => {
    try {
        await mongoose.connect(dbUri);
        console.log('MongoDB Connected');
    } catch (err) {
        console.error('Database connection error:', err.message);
        process.exit(1);
    }
};

module.exports = connectDB;
