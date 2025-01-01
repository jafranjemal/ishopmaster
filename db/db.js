const mongoose = require('mongoose');

// module.exports = {
//     mongoURI: 'mongodb+srv://jafranjemal:jafran123@cluster0.yai9p.mongodb.net/shimla-gem?retryWrites=true&w=majority'
//     ,secretOrKey:'secrect'
// };

const localUri = 'mongodb://localhost:27017/mobile-shop'
const mongoUri = 'mongodb+srv://jafranjemal:jafran123@cluster0.yai9p.mongodb.net/ishopmaster?retryWrites=true&w=majority'
const connectDB = async () => {
    try {
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB Connected');
    } catch (err) {
        console.error('Database connection error:', err.message);
        process.exit(1);
    }
};

module.exports = connectDB;
