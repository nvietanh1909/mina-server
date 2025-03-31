const mongoose = require('mongoose');
const notificationController = require('../../controllers/notificationController');
const Notification = require('../../models/notificationModel');

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
        ObjectId: jest.fn(),
        Mixed: jest.fn()
      }
    },
    model: jest.fn(),
    connect: jest.fn()
  };

  // Add Schema constructor to mockMongoose
  mockMongoose.Schema = mockSchema;
  mockMongoose.Schema.Types = {
    ObjectId: jest.fn(),
    Mixed: jest.fn()
  };

  return mockMongoose;
});

// Mock dependencies
jest.mock('../../models/notificationModel', () => ({
  create: jest.fn(),
  find: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateMany: jest.fn(),
  countDocuments: jest.fn()
}));

describe('NotificationController', () => {
  let req;
  let res;

  beforeEach(() => {
    req = {
      body: {},
      user: { id: 'mockUserId' },
      params: {},
      query: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();
  });

  describe('createNotification', () => {
    it('should create a notification successfully', async () => {
      // Arrange
      const userId = 'userId';
      const title = 'Test Notification';
      const message = 'This is a test notification';
      const type = 'info';
      const data = { test: 'data' };

      const mockNotification = {
        _id: 'notificationId',
        userId,
        title,
        message,
        type,
        data,
        isRead: false
      };

      Notification.create.mockResolvedValue(mockNotification);

      // Act
      const result = await notificationController.createNotification(userId, title, message, type, data);

      // Assert
      expect(Notification.create).toHaveBeenCalledWith({
        userId,
        title,
        message,
        type,
        data
      });
      expect(result).toEqual(mockNotification);
    });

    it('should return null when creation fails', async () => {
      // Arrange
      const userId = 'userId';
      const title = 'Test Notification';
      const message = 'This is a test notification';

      // Mock console.error to prevent error output in tests
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      Notification.create.mockRejectedValue(new Error('Creation failed'));

      // Act
      const result = await notificationController.createNotification(userId, title, message);

      // Assert
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Create notification error:', expect.any(Error));
      
      // Restore console.error
      consoleSpy.mockRestore();
    });
  });

  describe('getNotifications', () => {
    it('should get notifications with pagination', async () => {
      // Arrange
      const mockNotifications = [
        { _id: 'notif1', title: 'Test 1', message: 'Message 1' },
        { _id: 'notif2', title: 'Test 2', message: 'Message 2' }
      ];

      req.query = {
        page: 1,
        limit: 10
      };

      Notification.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockNotifications)
      });

      Notification.countDocuments.mockResolvedValue(2);

      // Act
      await notificationController.getNotifications(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: {
          notifications: mockNotifications,
          pagination: {
            total: 2,
            page: 1,
            pages: 1
          }
        }
      });
    });

    it('should filter notifications by isRead status', async () => {
      // Arrange
      const mockNotifications = [
        { _id: 'notif1', title: 'Test 1', message: 'Message 1', isRead: true }
      ];

      req.query = {
        isRead: 'true'
      };

      Notification.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockNotifications)
      });

      Notification.countDocuments.mockResolvedValue(1);

      // Act
      await notificationController.getNotifications(req, res);

      // Assert
      expect(Notification.find).toHaveBeenCalledWith({
        userId: 'mockUserId',
        isRead: true
      });
    });

    it('should handle errors when getting notifications', async () => {
      // Arrange
      const error = new Error('Database error');
      Notification.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockRejectedValue(error)
      });

      // Act
      await notificationController.getNotifications(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Database error'
      });
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read successfully', async () => {
      // Arrange
      const mockNotification = {
        _id: 'notificationId',
        userId: 'mockUserId',
        title: 'Test Notification',
        message: 'Test Message',
        isRead: true
      };

      req.params.notificationId = 'notificationId';
      Notification.findOneAndUpdate.mockResolvedValue(mockNotification);

      // Act
      await notificationController.markAsRead(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: {
          notification: mockNotification
        }
      });
    });

    it('should return error when notification not found', async () => {
      // Arrange
      req.params.notificationId = 'nonexistentId';
      Notification.findOneAndUpdate.mockResolvedValue(null);

      // Act
      await notificationController.markAsRead(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Không tìm thấy thông báo'
      });
    });

    it('should handle errors when marking notification as read', async () => {
      // Arrange
      req.params.notificationId = 'notificationId';
      Notification.findOneAndUpdate.mockRejectedValue(new Error('Database error'));

      // Act
      await notificationController.markAsRead(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Database error'
      });
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read successfully', async () => {
      // Arrange
      Notification.updateMany.mockResolvedValue({ modifiedCount: 2 });

      // Act
      await notificationController.markAllAsRead(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        message: 'Đã đánh dấu tất cả thông báo là đã đọc'
      });
    });

    it('should handle errors when marking all notifications as read', async () => {
      // Arrange
      Notification.updateMany.mockRejectedValue(new Error('Database error'));

      // Act
      await notificationController.markAllAsRead(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Database error'
      });
    });
  });

  describe('getUnreadCount', () => {
    it('should get unread notification count successfully', async () => {
      // Arrange
      Notification.countDocuments.mockResolvedValue(5);

      // Act
      await notificationController.getUnreadCount(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: {
          unreadCount: 5
        }
      });
    });

    it('should handle errors when getting unread count', async () => {
      // Arrange
      Notification.countDocuments.mockRejectedValue(new Error('Database error'));

      // Act
      await notificationController.getUnreadCount(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Database error'
      });
    });
  });
}); 