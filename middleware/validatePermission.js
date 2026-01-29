const { ApiError } = require("../utility/ApiError");

const validatePermission = (req, res, next) => {
  const { role, modulePermissions } = req.body;

  if (!role || !modulePermissions) {
    return res.status(400).json({
      message: 'Role and modulePermissions are required'
    });
  }

  const validRoles = ['Admin', 'Sales', 'Manager', 'Cashier', 'Support', 'Receptionist', 'Technician'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({
      message: 'Invalid role'
    });
  }

  next();
};

const authorize = (module, action) => {
  return async (req, res, next) => {
    try {
      // 1. Admin bypass
      if (req.user.roles.some(r => r.name === 'Admin')) return next();

      // 2. Check Permissions (Direct + Role-based)
      const hasAccess = await req.user.hasPermission(module, action);

      if (!hasAccess) {
        throw new ApiError(403, `Unauthorized: Cannot ${action} in ${module}`);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = { validatePermission, authorize };