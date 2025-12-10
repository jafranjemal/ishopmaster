// routes/dashboard.routes.js
const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");

// GET /api/dashboard/overview?range=today|week|month
router.get("/overview", dashboardController.overview);

module.exports = router;
