const express = require("express");
const router = express.Router();
const dashboardController = require("../../controllers/dashboardV2Controller");
// const { protect } = require("../../middleware/authMiddleware"); // Assuming auth middleware exists

router.get("/summary", dashboardController.overview);

module.exports = router;
