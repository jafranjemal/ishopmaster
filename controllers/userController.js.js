const User = require('../models/User'); // Adjust the path as necessary
const bcrypt = require('bcrypt'); // For password hashing
const mongoose = require('mongoose');

 
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Request Password Reset
exports.requestPasswordReset = async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
        return res.status(404).json({ message: 'User  not found' });
    }

    // Generate a reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetToken = resetToken;
    user.resetTokenExpiration = Date.now() + 3600000; // 1 hour
    await user.save();

    // Send email with reset link
    const transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const resetLink = `http://yourapp.com/reset-password/${resetToken}`;
    await transporter.sendMail({
        to: email,
        subject: 'Password Reset',
        html: `<p>You requested a password reset. Click <a href="${resetLink}">here</a> to reset your password.</p>`,
    });

    res.status(200).json({ message: 'Password reset link sent to your email' });
};

// Change Password
exports.changePassword = async (req, res) => {
    const { resetToken, newPassword } = req.body;
    const user = await User.findOne({ resetToken, resetTokenExpiration: { $gt: Date.now() } });

    if (!user) {
        return res.status(400).json({ message: 'Invalid or expired token' });
    }

    // Hash the new password
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetToken = undefined; // Clear the reset token
    user.resetTokenExpiration = undefined; // Clear the expiration
    await user.save();

    res.status(200).json({ message: 'Password changed successfully' });
};

exports.getHashPassword = async (req, res) => {
    const { password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    res.status(200).json({ hashedPassword });
}

exports.getReverseHashPassword = async (req, res) => {
    const { hashedPassword, providedPassword } = req.body;
  
    try {
      const isValid = await bcrypt.compare(providedPassword, hashedPassword);
      if (isValid) {
        res.json({ message: 'Password is valid' });
      } else {
        res.status(401).json({ message: 'Invalid password' });
      }
    } catch (error) {
      res.status(500).json({ message: 'Error verifying password' });
    }
  };

// Create a new user
exports.createUser  = async (req, res) => {
    const { username, password, email, employeeId, roles } = req.body;

    try {
        // Check if the user already exists
        const existingUser  = await User.findOne({ username });
        if (existingUser ) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create the user
        const user = new User({
            username,
            password: hashedPassword,
            email,
            employeeId,
            roles,
        });

        await user.save();
        res.status(201).json({ message: 'User  created successfully', user });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get all users
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find().populate('employeeId');
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get a user by ID
exports.getUserById = async (req, res) => {
    const { id } = req.params;

    try {
        const user = await User.findById(id).populate('employeeId');
        if (!user) return res.status(404).json({ message: 'User  not found' });
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update a user
exports.updateUser  = async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
console.log("updates",updates)
    try {
        // Check if the user exists
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: 'User  not found' });

        // Hash the new password if provided
        if (updates?.password) {
            updates.password = await bcrypt.hash(updates.password, 10);
        }

        // Update the user
        const updatedUser  = await User.findByIdAndUpdate(id, updates, { new: true });
        res.status(200).json(updatedUser );
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Delete a user
exports.deleteUser  = async (req, res) => {
    const { id } = req.params;

    try {
        const user = await User.findByIdAndDelete(id);
        if (!user) return res.status(404).json({ message: 'User  not found' });
        res.status(200).json({ message: 'User  deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};