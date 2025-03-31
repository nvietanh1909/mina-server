const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const auth = require('../middleware/authMiddleware');

// Áp dụng middleware auth cho tất cả routes
router.use(auth);

// Lấy danh sách thông báo
router.get('/', notificationController.getNotifications);

// Lấy số lượng thông báo chưa đọc
router.get('/unread-count', notificationController.getUnreadCount);

// Đánh dấu thông báo đã đọc
router.patch('/:notificationId/mark-read', notificationController.markAsRead);

// Đánh dấu tất cả thông báo đã đọc
router.patch('/mark-all-read', notificationController.markAllAsRead);

module.exports = router; 