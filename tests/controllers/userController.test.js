const User = require('../../models/userModel');
const Wallet = require('../../models/walletModel');
const Category = require('../../models/categoryModel');
const userController = require('../../controllers/userController');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const cloudflareService = require('../../services/cloudflareService');

// Set up environment variables for testing
process.env.CLOUDFLARE_ENDPOINT = 'https://test.cloudflare.com';
process.env.CLOUDFLARE_ACCESS_KEY = 'test-access-key';
process.env.CLOUDFLARE_SECRET_KEY = 'test-secret-key';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.MONGODB_URI = 'mongodb://localhost:27017/mina-test';

// Mock mongoose
jest.mock('mongoose', () => ({
  Schema: jest.fn().mockImplementation(() => ({
    index: jest.fn().mockReturnThis(),
    pre: jest.fn().mockReturnThis(),
    methods: {},
    statics: {}
  })),
  model: jest.fn(),
  connect: jest.fn(),
  connection: {
    close: jest.fn()
  },
  startSession: jest.fn().mockReturnValue({
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    abortTransaction: jest.fn()
  })
}));

// Mock cloudflareService
jest.mock('../../services/cloudflareService', () => ({
  uploadImage: jest.fn().mockResolvedValue('https://test-image-url.com'),
  deleteImage: jest.fn().mockResolvedValue(true)
}));

// Mock các dependencies
jest.mock('../../models/userModel');
jest.mock('../../models/walletModel');
jest.mock('../../models/categoryModel');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('../../services/cloudflareService');

describe('UserController', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
      user: { id: 'mockUserId' },
      file: null
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();
  });

  describe('register', () => {
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
      bcrypt.hash.mockResolvedValue('hashedPassword');
      jwt.sign.mockReturnValue('mockToken');

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
          categories: mockCategories,
          token: 'mockToken'
        }
      });
    }, 10000); // Increase timeout to 10 seconds

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
        message: 'User already exists'
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
    }, 10000); // Increase timeout to 10 seconds
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

    it('should handle duplicate email', async () => {
      req.user = { id: 'userId' };
      req.body = {
        email: 'existing@example.com'
      };

      // Mock User.findByIdAndUpdate to throw duplicate key error
      const duplicateError = new Error('Duplicate key error');
      duplicateError.code = 11000;
      duplicateError.keyPattern = { email: 1 };
      User.findByIdAndUpdate.mockRejectedValue(duplicateError);

      await userController.updateProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email đã được sử dụng'
      });
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

  describe('updateAvatar', () => {
    it('should update avatar successfully', async () => {
      req.user = { id: 'userId' };
      req.file = {
        buffer: Buffer.from('test-image'),
        mimetype: 'image/jpeg'
      };

      // Mock cloudflareService.uploadImage
      cloudflareService.uploadImage.mockResolvedValue('https://example.com/avatar.jpg');

      // Mock User.findByIdAndUpdate
      const mockUser = {
        _id: 'userId',
        avatar: 'https://example.com/avatar.jpg',
        updatedAt: new Date()
      };
      User.findByIdAndUpdate.mockResolvedValue(mockUser);

      await userController.updateAvatar(req, res);

      expect(cloudflareService.uploadImage).toHaveBeenCalledWith(
        req.file.buffer,
        req.file.mimetype
      );
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        req.user.id,
        { avatar: 'https://example.com/avatar.jpg' },
        { new: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockUser
      });
    });

    it('should handle upload error', async () => {
      req.user = { id: 'userId' };
      req.file = {
        buffer: Buffer.from('test-image'),
        mimetype: 'image/jpeg'
      };

      // Mock cloudflareService.uploadImage to throw error
      cloudflareService.uploadImage.mockRejectedValue(new Error('Upload failed'));

      await userController.updateAvatar(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Error uploading avatar'
      });
    });
  });
}); 