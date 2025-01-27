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
  
  module.exports = { validatePermission };