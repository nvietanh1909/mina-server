const User = require('../../models/userModel');
const Wallet = require('../../models/walletModel');
const Category = require('../../models/categoryModel');
const userController = require('../../controllers/userController');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Mock các dependencies
jest.mock('../../models/userModel');
jest.mock('../../models/walletModel');
jest.mock('../../models/categoryModel');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

describe('UserController', () => {
  let req;
  let res;
  
  beforeEach(() => {
    req = {
      body: {},
      user: { id: 'mockUserId' }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();
  });

  describe('register', () => {
    beforeEach(() => {
      // Mock startSession
      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn()
      };
      User.startSession = jest.fn().mockResolvedValue(mockSession);
      
      // Mock các phương thức khác
      User.findOne = jest.fn();
      User.create = jest.fn();
      Wallet.create = jest.fn();
      Category.create = jest.fn();
      jwt.sign = jest.fn().mockReturnValue('mockToken');
    });

    it('should register a new user successfully', async () => {
      // Arrange
      const mockUser = [{
        _id: 'mockUserId',
        email: 'test@example.com',
        name: 'Test User'
      }];
      
      const mockWallet = [{
        _id: 'mockWalletId',
        name: 'Wallet',
        balance: 0
      }];

      const mockCategories = [
        { _id: 'cat1', name: 'Food', icons: [] },
        { _id: 'cat2', name: 'Transport', icons: [] }
      ];

      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue(mockUser);
      Wallet.create.mockResolvedValue(mockWallet);
      Category.create.mockResolvedValue(mockCategories);

      req.body = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      };

      // Act
      await userController.register(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: {
          user: {
            id: mockUser[0]._id,
            email: mockUser[0].email,
            name: mockUser[0].name
          },
          wallet: {
            id: mockWallet[0]._id,
            name: mockWallet[0].name,
            balance: mockWallet[0].balance
          },
          categories: expect.any(Array),
          token: 'mockToken'
        }
      });
    });

    it('should return error if email already exists', async () => {
      // Arrange
      User.findOne.mockResolvedValue({ email: 'test@example.com' });
      
      req.body = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      };

      // Act
      await userController.register(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Email is already in use'
      });
    });

    it('should return error if required fields are missing', async () => {
      // Arrange
      req.body = {
        email: 'test@example.com'
        // missing password and name
      };

      // Act
      await userController.register(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Please provide email, password and name'
      });
    });
  });

  describe('login', () => {
    it('should login successfully with correct credentials', async () => {
      // Arrange
      const mockUser = {
        _id: 'mockUserId',
        email: 'test@example.com',
        name: 'Test User',
        comparePassword: jest.fn().mockResolvedValue(true)
      };

      User.findOne = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

      jwt.sign.mockReturnValue('mockToken');

      req.body = {
        email: 'test@example.com',
        password: 'password123'
      };

      // Act
      await userController.login(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: {
          user: {
            id: mockUser._id,
            email: mockUser.email,
            name: mockUser.name
          },
          token: 'mockToken'
        }
      });
    });

    it('should return error with incorrect credentials', async () => {
      // Arrange
      const mockUser = {
        comparePassword: jest.fn().mockResolvedValue(false)
      };

      User.findOne = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

      req.body = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      // Act
      await userController.login(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Incorrect email or password'
      });
    });
  });

  describe('updateProfile', () => {
    it('should update user name successfully', async () => {
      // Arrange
      const mockUpdatedUser = {
        _id: 'mockUserId',
        email: 'test@example.com',
        name: 'Updated Name'
      };

      User.findByIdAndUpdate = jest.fn().mockResolvedValue(mockUpdatedUser);

      req.body = {
        name: 'Updated Name'
      };

      // Act
      await userController.updateProfile(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: {
          user: {
            id: mockUpdatedUser._id,
            email: mockUpdatedUser.email,
            name: mockUpdatedUser.name
          }
        }
      });
    });

    it('should update password successfully', async () => {
      // Arrange
      const mockUser = {
        _id: 'mockUserId',
        email: 'test@example.com',
        name: 'Test User',
        comparePassword: jest.fn().mockResolvedValue(true)
      };

      User.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

      bcrypt.genSalt = jest.fn().mockResolvedValue('mockSalt');
      bcrypt.hash = jest.fn().mockResolvedValue('hashedPassword');

      User.findByIdAndUpdate = jest.fn().mockResolvedValue(mockUser);

      req.body = {
        currentPassword: 'currentPass',
        newPassword: 'newPassword123'
      };

      // Act
      await userController.updateProfile(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(bcrypt.hash).toHaveBeenCalled();
    });
  });

  describe('getProfile', () => {
    it('should get user profile successfully', async () => {
      // Arrange
      const mockUser = {
        _id: 'mockUserId',
        email: 'test@example.com',
        name: 'Test User'
      };

      User.findById = jest.fn().mockResolvedValue(mockUser);

      // Act
      await userController.getProfile(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: {
          user: {
            id: mockUser._id,
            email: mockUser.email,
            name: mockUser.name
          }
        }
      });
    });
  });
}); 