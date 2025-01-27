const express = require('express');
const router = express.Router();
const permissionController = require('../controllers/permissionController');
const { authenticate } = require('../middleware/auth');
const { validatePermission } = require('../middleware/validatePermission');

// CRUD Routes
router.post('/', 
  authenticate,
  validatePermission,
  permissionController.createPermissions
);
router.post('/bulk-assign', authenticate, permissionController.bulkCreateAndAssignToRole);


router.get('/', 
  authenticate,
  permissionController.getAllPermissions
);

router.get('/:role',
  authenticate,
  permissionController.getPermissionByRole
);

router.put('/:role',
  authenticate,
  validatePermission,
  permissionController.updatePermission
);

router.delete('/:role',
  authenticate,
  permissionController.deletePermission
);

module.exports = router;