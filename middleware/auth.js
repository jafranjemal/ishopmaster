const jwt = require('jsonwebtoken');
const User = require('../models/User');
 

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('Authentication required');
    }

    // Extract and verify token
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user details
    const user = await User.findById(decoded.userId)
      .select('-password')
      .populate('roles');

    if (!user || !user.isActive) {
      throw new Error('User not found or inactive');
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      next('Invalid token');
    } else if (error.name === 'TokenExpiredError') {
      next('Token expired');
    } else {
      next(error);
    }
  }
};

module.exports = { authenticate };