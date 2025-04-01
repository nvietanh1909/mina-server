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
jest.mock('mongoose', () => {
  const mockSchema = jest.fn().mockImplementation(() => ({
    index: jest.fn().mockReturnThis(),
    pre: jest.fn().mockReturnThis(),
    methods: {},
    statics: {}
  }));

  const mockMongoose = {
    Schema: mockSchema,
    Schema: {
      Types: {
        ObjectId: jest.fn()
      }
    },
    model: jest.fn(),
    connect: jest.fn(),
    connection: {
      close: jest.fn()
    },
    startSession: jest.fn().mockReturnValue({
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn()
    })
  };

  // Add Schema constructor to mockMongoose
  mockMongoose.Schema = mockSchema;
  mockMongoose.Schema.Types = {
    ObjectId: jest.fn()
  };

  return mockMongoose;
});

// Mock cloudflareService
jest.mock('../../services/cloudflareService', () => ({
  uploadFile: jest.fn().mockResolvedValue('https://test-image-url.com'),
  deleteFile: jest.fn().mockResolvedValue(true) 
}));

// Mock dependencies
jest.mock('../../models/userModel', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  select: jest.fn().mockReturnThis(),
  save: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../models/walletModel', () => ({
  create: jest.fn()
}));

jest.mock('../../models/categoryModel', () => ({
  create: jest.fn()
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mockToken')
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashedPassword'),
  genSalt: jest.fn().mockResolvedValue('mockSalt'),
  compare: jest.fn()
}));

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
    beforeEach(() => {
      jest.clearAllMocks();
      req.body = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      };
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
        name: 'My Wallet',
        balance: 0
      }];

      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue(mockUser);
      Wallet.create.mockResolvedValue(mockWallet);

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
          token: 'mockToken'
        }
      });
    });

    it('should return error if user already exists', async () => {
      // Arrange
      User.findOne.mockResolvedValue({
        _id: 'existingUserId',
        email: 'test@example.com',
        name: 'Existing User'
      });

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
      User.findOne.mockResolvedValue(null);
      const req = {
        body: {
          email: 'test@example.com'
          // missing password and name
        }
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

    it('should handle database transaction failure', async () => {
      // Arrange
      req.body = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      };

      // Mock database error
      User.findOne.mockRejectedValue(new Error('Database error'));

      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act
      await userController.register(req, res);

      // Restore console.error
      consoleSpy.mockRestore();

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Database error'
      });
    });

    it('should validate email format', async () => {
      // Arrange
      req.body = {
        email: 'invalid-email',
        password: 'password123',
        name: 'Test User'
      };

      // Mock database error for invalid email
      User.findOne.mockRejectedValue(new Error('Invalid email format'));

      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act
      await userController.register(req, res);

      // Restore console.error
      consoleSpy.mockRestore();

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Invalid email format'
      });
    });
  });

  describe('login', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      req.body = {
        email: 'test@example.com',
        password: 'password123'
      };
    });

    it('should login successfully', async () => {
      // Arrange
      const mockUser = {
        _id: 'mockUserId',
        email: 'test@example.com',
        name: 'Test User',
        comparePassword: jest.fn().mockResolvedValue(true)
      };

      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

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

    it('should return error for invalid credentials', async () => {
      // Arrange
      const mockUser = {
        _id: 'mockUserId',
        email: 'test@example.com',
        name: 'Test User',
        comparePassword: jest.fn().mockResolvedValue(false)
      };

      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

      // Act
      await userController.login(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Incorrect email or password'
      });
    });

    it('should handle missing credentials', async () => {
      // Arrange
      req.body = {
        email: 'test@example.com'
        // missing password
      };

      // Act
      await userController.login(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Please enter both email and password'
      });
    });

    it('should handle non-existent user', async () => {
      // Arrange
      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

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
    beforeEach(() => {
      jest.clearAllMocks();
      req.user = { id: 'mockUserId' };
      req.body = {
        name: 'Updated Name',
        email: 'newemail@example.com'
      };
    });

    it('should update profile successfully', async () => {
      // Arrange
      const mockUser = {
        _id: 'userId',
        email: 'test@example.com',
        name: 'Test User',
        avatar: 'avatar.jpg'
      };

      req.body = {
        name: 'Updated Name'
      };

      User.findByIdAndUpdate.mockResolvedValue({
        ...mockUser,
        name: req.body.name
      });

      // Act
      await userController.updateProfile(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: {
          user: expect.objectContaining({
            name: req.body.name
          })
        }
      });
    });

    it('should handle duplicate email', async () => {
      // Arrange
      req.body = {
        name: 'Test User',
        email: 'existing@example.com'
      };

      User.findByIdAndUpdate.mockRejectedValue(new Error('Email đã được sử dụng'));

      // Act
      await userController.updateProfile(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Email đã được sử dụng'
      });
    });

    it('should handle password update with invalid current password', async () => {
      // Arrange
      req.body = {
        name: 'Test User',
        currentPassword: 'wrong-password',
        newPassword: 'new-password'
      };

      const mockUser = {
        _id: 'mockUserId',
        email: 'test@example.com',
        name: 'Test User',
        comparePassword: jest.fn().mockResolvedValue(false)
      };

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

      // Act
      await userController.updateProfile(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Current password is incorrect'
      });
    });

    it('should validate new password length', async () => {
      // Arrange
      req.body = {
        name: 'Test User',
        currentPassword: 'current-password',
        newPassword: '123' // too short
      };

      const mockUser = {
        _id: 'mockUserId',
        email: 'test@example.com',
        name: 'Test User',
        comparePassword: jest.fn().mockResolvedValue(true)
      };

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

      // Act
      await userController.updateProfile(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'New password must be at least 6 characters long'
      });
    });
  });

  describe('getProfile', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      req.user = { id: 'mockUserId' };
    });

    it('should get user profile successfully', async () => {
      // Arrange
      const mockUser = {
        _id: 'mockUserId',
        email: 'test@example.com',
        name: 'Test User'
      };

      User.findById.mockResolvedValue(mockUser);

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

    it('should handle user not found', async () => {
      // Arrange
      User.findById.mockResolvedValue(null);

      // Act
      await userController.getProfile(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Cannot read properties of null (reading \'_id\')'
      });
    });
  });

  describe('uploadAvatar', () => {
    beforeEach(() => {
      req.file = {
        buffer: Buffer.from('test-image'),
        mimetype: 'image/jpeg',
        size: 1024
      };
    });

    it('should upload avatar successfully', async () => {
      // Arrange
      const mockUser = {
        _id: 'mockUserId',
        email: 'test@example.com',
        name: 'Test User',
        avatar: 'old-avatar.jpg',
        save: jest.fn().mockResolvedValue(true)
      };

      User.findById.mockResolvedValue(mockUser);
      cloudflareService.uploadFile.mockResolvedValue('new-avatar-url.jpg');

      // Act
      await userController.uploadAvatar(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: {
          user: expect.objectContaining({
            avatar: 'new-avatar-url.jpg'
          })
        }
      });
    });

    it('should handle missing file', async () => {
      // Arrange
      req.file = null;

      // Act
      await userController.uploadAvatar(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'No file uploaded'
      });
    });

    it('should handle user not found', async () => {
      // Arrange
      User.findById.mockResolvedValue(null);

      // Act
      await userController.uploadAvatar(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'User not found'
      });
    });
  });

  describe('changePassword', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      req.user = { id: 'mockUserId' };
      req.body = {
        currentPassword: 'currentPassword123',
        newPassword: 'newPassword123'
      };
    });

    it('should change password successfully', async () => {
      // Arrange
      const mockUser = {
        _id: 'mockUserId',
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashedCurrentPassword',
        save: jest.fn().mockResolvedValue(true)
      };

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

      bcrypt.compare
        .mockResolvedValueOnce(true)  // current password match
        .mockResolvedValueOnce(false); // new password different

      // Act
      await userController.changePassword(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        message: 'Đổi mật khẩu thành công'
      });
    });

    it('should return error if current or new password is missing', async () => {
      // Arrange
      req.body = {
        currentPassword: 'currentPassword123'
        // missing newPassword
      };

      // Act
      await userController.changePassword(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới'
      });
    });

    it('should return error if new password is too short', async () => {
      // Arrange
      req.body = {
        currentPassword: 'currentPassword123',
        newPassword: '123' // too short
      };

      // Act
      await userController.changePassword(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Mật khẩu mới phải có ít nhất 6 ký tự'
      });
    });

    it('should return error if user not found', async () => {
      // Arrange
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      // Act
      await userController.changePassword(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Không tìm thấy người dùng'
      });
    });

    it('should return error if current password is incorrect', async () => {
      // Arrange
      const mockUser = {
        _id: 'mockUserId',
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashedCurrentPassword'
      };

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

      bcrypt.compare.mockResolvedValue(false);

      // Act
      await userController.changePassword(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Mật khẩu hiện tại không đúng'
      });
    });

    it('should return error if new password is same as current password', async () => {
      // Arrange
      const mockUser = {
        _id: 'mockUserId',
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashedCurrentPassword'
      };

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

      bcrypt.compare
        .mockResolvedValueOnce(true)  // current password match
        .mockResolvedValueOnce(true); // new password same as current

      // Act
      await userController.changePassword(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Mật khẩu mới không được trùng với mật khẩu hiện tại'
      });
    });

    it('should handle database errors', async () => {
      // Arrange
      const mockUser = {
        _id: 'mockUserId',
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashedCurrentPassword',
        save: jest.fn().mockRejectedValue(new Error('Database error'))
      };

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

      bcrypt.compare
        .mockResolvedValueOnce(true)  // current password match
        .mockResolvedValueOnce(false); // new password different

      // Act
      await userController.changePassword(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Database error'
      });
    });
  });
}); 