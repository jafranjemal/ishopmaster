const express = require('express');
const bodyParser = require('body-parser');
const http = require("http");
const connectDB = require('./db/db');
var cors = require("cors");
const cron = require('node-cron');
const socketIo = require("socket.io");
require('dotenv').config();

const { seedDatabase } = require('./seed');
const app = express();
const server = http.createServer(app);
// const io = require('socket.io')(http, {
//     cors: {
//       origin: "http://localhost:3000"
//     }
//   });

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.set("socketio", io);

const PORT = process.env.PORT || 5000;

// Middleware

app.use(bodyParser.json({ limit: "5mb" }));
app.use(bodyParser.urlencoded({ limit: "5mb", extended: true }));
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true
}));



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
const notificationRoutes = require("./routes/notificationRoutes");
const barcodeRoutes = require("./routes/barcodeRoutes");
const salesInvoiceRoutes = require("./routes/salesInvoiceRoutes");
const userRoutes = require("./routes/userRoutes");
const shiftsRoutes = require("./routes/shiftRoutes");
const permissionRoutes = require('./routes/permissionRoutes');
const authRoutes = require('./routes/authRoutes');
const roleRoutes = require('./routes/roleRoutes');
const errorHandler = require('./middleware/errorHandler');
const ticketRoutes = require("./routes/ticketRoutes");
const phoneModelRoutes = require("./routes/phoneModelRoutes");
const serviceItemRoutes = require("./routes/serviceItemRoutes");
const barcodeSettingsRoutes = require("./routes/barcodeSettingsRoutes");
const BwipJs = require('bwip-js');
const deviceRoutes = require("./routes/deviceRoutes");
const deviceInspectionRoutes = require("./routes/deviceInspectionRoutes");
const reportedIssueRoutes = require("./routes/reportedIssueRoutes");
const serializedStockRoutes = require("./routes/serializedStock");
const noneSerializedStockRoutes = require("./routes/nonSerializedStock");
const dashboardRoutes = require("./routes/dashboard/dashboardRoutes");
const stockLedgerRoutes = require("./routes/stockLedgerRoutes");
const warrantyRoutes = require("./routes/warrantyRoutes");
const purchaseReturnRoutes = require("./routes/purchaseReturnRoutes");
const systemRoutes = require("./routes/systemRoutes");
const reportRoutes = require("./routes/reportRoutes");
const itemVariantRoutes = require("./routes/itemVariantRoutes");
const attributeRoutes = require("./routes/attributeRoutes");
const expenseRoutes = require("./routes/expenseRoutes");

app.use('/api/items', productRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/purchase", purchaseRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/serializedStock", serializedStockRoutes);
app.use("/api/noneSerializedStock", noneSerializedStockRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/units", unitRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/barcode", barcodeRoutes);
app.use("/api/sales-invoices", salesInvoiceRoutes);
app.use("/api/users", userRoutes);
app.use("/api/shifts", shiftsRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/system', require('./routes/systemRoutes')); // System setup routes (public)
app.use('/api/auth', authRoutes);
app.use('/api/role', roleRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/phone-models", phoneModelRoutes);
app.use("/api/service-items", serviceItemRoutes);
app.use('/api/barcode-settings', barcodeSettingsRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/device-inspections", deviceInspectionRoutes);
app.use("/api/reported-issues", reportedIssueRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/stock-ledger", stockLedgerRoutes);
app.use("/api/warranties", warrantyRoutes);
app.use("/api/purchase-returns", purchaseReturnRoutes);
app.use("/api/system", systemRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/variants", itemVariantRoutes);
app.use("/api/attributes", attributeRoutes);
app.use("/api/expenses", expenseRoutes);

app.post('/api/print-barcodes', async (req, res) => {
  const { items } = req.body;

  try {
    const barcodes = [];
    for (const item of items) {
      const barcodeBuffer = await BwipJs.toBuffer({
        bcid: 'code128', // Barcode type
        text: item.barcode, // Text to encode
        scale: 3, // 3x scaling factor
        height: 10, // Bar height, in millimeters
        includetext: true, // Show human-readable text
        textxalign: 'center', // Always good to set this
      });
      barcodes.push({ sellingPrice: item.lastSellingPrice, itemName: item.itemName, barcode: item.barcode, buffer: barcodeBuffer.toString('base64') });
    }
    res.json({ success: true, barcodes });
  } catch (error) {
    console.error('Error generating barcodes:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating barcodes',
      error: error.message
    });
  }
});

// Schedule the task to run every hour
//cron.schedule('0 * * * *', checkStockLevels);
// Schedule the task to run every second 


// Handle Socket.IO connections
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  setInterval(
    () => sendNotification(socket),
    10000
  );

  // Disconnect event
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// Broadcast notifications to connected clients
function sendNotification(notification) {
  try {

    io.emit("new-notification", notification); // Broadcast to all connected clients
  } catch (x) {
    console.error(`Error: ${x}`);
  }
};


app.get("/", (req, res) => {
  res.send({ response: "I am alive" }).status(200);
});

app.get("/seed", async (req, res) => {
  try {
    await seedDatabase();
    res.status(200).send({ message: "Database seeded successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error seeding database" });
  }
});


// Error handling middleware
// app.use((err, req, res, next) => {
//   // Handle the error here
//   res.status(err.status || 500).send({ message: err.message });
// });

app.use(errorHandler);

// Unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error('Error:', err);
  server.close(() => {
    process.exit(1);
  });
});

// Uncaught exceptions
process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error('Error:', err);
  process.exit(1);
});


const dbType = process.env.NODE_ENV === 'production' ? 'Cloud' : 'Local';

if (require.main === module) {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT} in ${process.env.NODE_ENV} environment with ${dbType} database`);
  });
  io.listen(4000);
}

module.exports = { sendNotification, app, server, io };