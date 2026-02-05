const express = require("express");
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/validatePermission');
const accountController = require("../controllers/accountController");
const { ApiError } = require("../utility/ApiError");

// Account APIs
router.get("/", authenticate, async (req, res, next) => {
    try {
        // 1. Admin bypass
        if (req.user.roles.some(r => r.name === 'Admin')) return next();

        // 2. Check for broad access
        const hasBroadAccess = await req.user.hasPermission('companyAccount', 'view');
        if (hasBroadAccess) return next();

        // 3. POS / Operational Bypass: If they can use POS, Payments, Sales, or Manage Shifts/Purchases
        const hasOpsAccess = await req.user.hasPermission('pos', 'view') ||
            await req.user.hasPermission('payments', 'view') ||
            await req.user.hasPermission('sales', 'view') ||
            await req.user.hasPermission('companyAccount', 'view') ||
            await req.user.hasPermission('shift', 'view') ||
            await req.user.hasPermission('purchase', 'view') ||
            await req.user.hasPermission('customersAccount', 'view') ||
            await req.user.hasPermission('supplierAccount', 'view');

        if (hasOpsAccess) {
            return next();
        }

        throw new ApiError(403, "Unauthorized: Cannot view global accounts");
    } catch (error) {
        next(error);
    }
}, accountController.getAllAccounts);

router.post("/", authenticate,
    authorize('companyAccount', 'create'), accountController.createAccount);
router.get("/:id", authenticate, authorize('companyAccount', 'view'), accountController.getAccountById);
router.get("/owner/:type/:id", authenticate, authorize('companyAccount', 'view'), accountController.getAccountByOwner);
router.put("/:id", authenticate, authorize('companyAccount', 'edit'), accountController.updateAccount);
router.delete("/:id", authenticate, authorize('companyAccount', 'delete'), accountController.deleteAccount);

module.exports = router;
