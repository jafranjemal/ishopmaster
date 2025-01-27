const express = require('express');
const bodyParser = require('body-parser');
const http = require("http");
const connectDB = require('./db/db');
var cors = require("cors");
const cron = require('node-cron');
const socketIo = require("socket.io");
require('dotenv').config();
const errorHandler = require('./middleware/errorHandler');
const { seedDatabase } = require('./seed');
const app = express();
const server = http.createServer(app);
// const io = require('socket.io')(http, {
//     cors: {
//       origin: "http://localhost:3000"
//     }
//   });

const io = socketIo(server);
const PORT = process.env.PORT || 5000;

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
const notificationRoutes = require("./routes/notificationRoutes");
const barcodeRoutes = require("./routes/barcodeRoutes");
const salesInvoiceRoutes = require("./routes/salesInvoiceRoutes");
const userRoutes = require("./routes/userRoutes");
const shiftsRoutes = require("./routes/shiftRoutes");
const permissionRoutes = require('./routes/permissionRoutes');
const authRoutes = require('./routes/authRoutes');
const roleRoutes = require('./routes/roleRoutes');



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
app.use("/api/notifications", notificationRoutes);
app.use("/api/barcode", barcodeRoutes);
app.use("/api/sales-invoices", salesInvoiceRoutes);
app.use("/api/users", userRoutes);
app.use("/api/shifts", shiftsRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/role', roleRoutes);
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
    try{

        io.emit("new-notification", notification); // Broadcast to all connected clients
    }catch(x){
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


app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
io.listen(4000);
module.exports = {sendNotification};