const Notification = require('../models/notificationModel');

// Tạo thông báo mới
exports.createNotification = async (userId, title, message, type = 'info', data = null) => {
  try {
    const notification = await Notification.create({
      userId,
      title,
      message,
      type,
      data
    });
    return notification;
  } catch (error) {
    console.error('Create notification error:', error);
    return null;
  }
};

// Lấy danh sách thông báo của user
exports.getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 10, isRead } = req.query;
    const query = { userId: req.user.id };
    
    if (typeof isRead !== 'undefined') {
      query.isRead = isRead === 'true';
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Notification.countDocuments(query);

    res.status(200).json({
      status: 'success',
      data: {
        notifications,
        pagination: {
          total,
          page: Number(page),
          pages: Math.ceil(total / limit)
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

// Đánh dấu thông báo đã đọc
exports.markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId: req.user.id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        status: 'error',
        message: 'Không tìm thấy thông báo'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        notification
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
};

// Đánh dấu tất cả thông báo đã đọc
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, isRead: false },
      { isRead: true }
    );

    res.status(200).json({
      status: 'success',
      message: 'Đã đánh dấu tất cả thông báo là đã đọc'
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
};

// Lấy số lượng thông báo chưa đọc
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      userId: req.user.id,
      isRead: false
    });

    res.status(200).json({
      status: 'success',
      data: {
        unreadCount: count
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
}; 