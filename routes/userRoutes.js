const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController.js');

// Create a new user
router.post('/', userController.createUser );

// Get all users
router.get('/', userController.getAllUsers);

// Get a user by ID
router.get('/:id', userController.getUserById);

// Update a user
router.put('/:id', userController.updateUser );

// Delete a user
router.delete('/:id', userController.deleteUser );


router.post('/request-password-reset', userController.requestPasswordReset);

// Change password
router.post('/change-password', userController.changePassword);
router.post('/getHashPassword', userController.getHashPassword);
router.post('/reverseHashPassword', userController.getReverseHashPassword);

module.exports = router;