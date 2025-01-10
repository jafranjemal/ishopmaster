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
const supplierRoutes = require("./routes/supplierRoutes");
const purchaseRoutes = require("./routes/purchaseRoutes");
const stockRoutes = require("./routes/stockRoutes");
const accountRoutes = require("./routes/accountRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const companyRoutes = require("./routes/companyRoutes");
const customerRoutes = require("./routes/customerRoutes");
const brandRoutes = require("./routes/brandRoutes");
const unitRoutes = require("./routes/unitRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

app.use('/api/items', productRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/purchase", purchaseRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/units", unitRoutes);
app.use("/api/payments", paymentRoutes);

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
