const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const auth = require('../middleware/authMiddleware');

// Tất cả các route báo cáo đều yêu cầu xác thực
router.use(auth);

// Route lấy báo cáo hàng ngày
router.get('/daily', reportController.getDailyReport);

// Route lấy báo cáo hàng tuần
router.get('/weekly', reportController.getWeeklyReport);

// Route lấy báo cáo hàng tháng
router.get('/monthly', reportController.getMonthlyReport);

// Route lấy báo cáo hàng năm
router.get('/yearly', reportController.getYearlyReport);

module.exports = router;