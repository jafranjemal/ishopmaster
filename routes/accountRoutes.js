const express = require("express");
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/validatePermission');
const accountController = require("../controllers/accountController");

// Account APIs
router.post("/", authenticate,
    authorize('accounts', 'create'), accountController.createAccount);
router.get("/", authenticate,
    authorize('accounts', 'view'), accountController.getAllAccounts);
router.get("/:id", accountController.getAccountById);
router.get("/owner/:type/:id", accountController.getAccountByOwner);
router.put("/:id", accountController.updateAccount);
router.delete("/:id", accountController.deleteAccount);

module.exports = router;
