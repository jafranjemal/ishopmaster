const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { ApiError } = require('../utility/ApiError');
const Role = require('../models/Role');
const Permissions = require('../models/Permissions');
class AuthService {
  async login(username, password) {
    try {
      // Validate inputs
      if (!username || !password) {
        throw new ApiError(400, 'Username and password are required');
      }

      // 1. Fetch user with minimal required populations for session
      const user = await User.findOne({ username })
        .select('+password')
        .populate({
          path: 'roles',
          populate: { path: 'permissions' }
        })
        .populate('employeeId')
        .populate('directPermissions.permission');

      if (!user) {
        throw new ApiError(401, 'Username not found');
      }

      if (!user.isActive) {
        throw new ApiError(401, 'Account is inactive. Please contact admin.');
      }

      // 2. Compare password
      const isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) {
        throw new ApiError(401, 'Incorrect password');
      }

      // 3. Update last login atomically (faster than .save())
      await User.findByIdAndUpdate(user._id, { $set: { lastLogin: new Date() } });

      // 4. Generate token
      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Clean sensitive data
      user.password = undefined;

      console.log('User logged in successfully:', user.username);
      return {
        success: true,
        statusCode: 200,
        data: {
          user,
          token
        }
      };

    } catch (error) {
      console.error('AuthService Login Error:', error.message);
      throw error;
    }
  }
}

module.exports = new AuthService();