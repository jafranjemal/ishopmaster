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

      const user = await User.findOne({ username })
      .select('+password')
      .populate({
        path: 'roles',
        model: 'Role',
        populate: {
          path: 'permissions',
          model: 'Permissions'
        }
      })
      .populate('employeeId')
      .populate('directPermissions.permission');
    
    console.log('Query:',   user?.employeeId  );
     
    
  
      if (!user || !user.isActive) {
        throw new ApiError(401, 'Invalid credentials');
      }

      // Compare password
      const isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) {
        throw new ApiError(401, 'Invalid credentials');
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate token
      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Remove sensitive data
      user.password = undefined;

      console.log('User logged in:', user.username);
      return {
        success: true,
        statusCode: 200,
        data: {
          user,
          token
        }
      };

    } catch (error) {
      throw error;
    }
  }
}

module.exports = new AuthService();