const express = require('express');
const bodyParser = require('body-parser');
const connectDB = require('./db/db');
var cors = require("cors");

const app = express();
const PORT = 5000;

// Middleware
app.use(bodyParser.json());
app.use(cors())
// Database Connection
connectDB();

// Routes
const productRoutes = require('./routes/productRoutes');
app.use('/api/items', productRoutes);

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
