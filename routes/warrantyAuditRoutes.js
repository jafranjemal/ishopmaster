const express = require("express");
const router = express.Router();
const warrantyAuditController = require("../controllers/warrantyAuditController");

router.post("/log", warrantyAuditController.logCheck);
router.get("/history/:imei", warrantyAuditController.getDeviceHistory);

module.exports = router;
