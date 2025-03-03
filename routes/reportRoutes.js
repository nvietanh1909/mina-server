const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const auth = require('../middleware/authMiddleware');

// Tất cả các route báo cáo đều yêu cầu xác thực
// router.use(auth);

// Lấy báo cáo theo tháng (GET /api/reports/monthly?year=2025&month=3&walletId=123)
router.get('/monthly', reportController.getMonthlyReport);

// Lấy báo cáo theo năm (GET /api/reports/annual?year=2025&walletId=123)
router.get('/annual', reportController.getAnnualReport);

// Lấy báo cáo theo danh mục (GET /api/reports/category?startDate=2025-01-01&endDate=2025-03-31&walletId=123)
router.get('/category', reportController.getCategoryReport);

// Tạo báo cáo giao dịch (POST /api/reports/transaction)
router.post('/transaction', reportController.generateTransactionReport);

module.exports = router;