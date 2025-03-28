const User = require('../models/userModel');
const Wallet = require('../models/walletModel');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Category = require('../models/categoryModel');
const mongoose = require('mongoose');

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d'
  });
};

exports.register = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        status: 'error',
        message: 'User already exists'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Start transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Create user
      const user = await User.create([{
        email,
        password: hashedPassword,
        name
      }], { session });

      // Create default wallet
      const wallet = await Wallet.create([{
        userId: user[0]._id,
        name: 'My Wallet',
        balance: 0
      }], { session });

      // Generate token
      const token = generateToken(user[0]._id);

      // Commit transaction
      await session.commitTransaction();

      // Send response
      res.status(201).json({
        status: 'success',
        data: {
          user: {
            id: user[0]._id,
            email: user[0].email,
            name: user[0].name
          },
          wallet: {
            id: wallet[0]._id,
            name: wallet[0].name,
            balance: wallet[0].balance
          },
          token
        }
      });
    } catch (error) {
      // If anything fails, abort transaction
      await session.abortTransaction();
      throw error;
    } finally {
      // End session
      session.endSession();
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'An error occurred during registration'
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Please enter both email and password'
      });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        status: 'error',
        message: 'Incorrect email or password'
      });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name
        },
        token
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, currentPassword, newPassword } = req.body;
    const updateData = {};

    // Update name if provided
    if (name) {
      updateData.name = name;
    }

    // Update password if provided
    if (currentPassword && newPassword) {
      const user = await User.findById(req.user.id).select('+password');
      
      if (!(await user.comparePassword(currentPassword))) {
        return res.status(400).json({
          status: 'error',
          message: 'Current password is incorrect'
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          status: 'error',
          message: 'New password must be at least 6 characters long'
        });
      }

      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(newPassword, salt);
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name
        }
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name
        }
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
};