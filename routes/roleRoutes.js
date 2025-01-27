const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, roleController.createRole);
router.get('/', authenticate, roleController.getAllRoles);
router.get('/:id', authenticate, roleController.getRoleById);
router.put('/:id', authenticate, roleController.updateRole);
router.delete('/:id', authenticate, roleController.deleteRole);
router.post('/:id/permissions', authenticate, roleController.addPermissions);
router.delete('/:id/permissions', authenticate, roleController.removePermissions);

module.exports = router;