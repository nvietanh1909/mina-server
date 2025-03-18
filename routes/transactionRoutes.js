const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const auth = require('../middleware/authMiddleware');

// Sử dụng middleware xác thực cho tất cả các route
router.use(auth);

// Tạo giao dịch mới
router.post('/', transactionController.createTransaction);

// Lấy danh sách giao dịch
router.get('/', transactionController.getTransactions);

// Thống kê giao dịch
router.get('/stats', transactionController.getTransactionStats);

// Lấy chi tiết một giao dịch
router.get('/:id', transactionController.getTransaction);

// Cập nhật giao dịch
router.patch('/:id', transactionController.updateTransaction);

// Xóa giao dịch
router.delete('/:id', transactionController.deleteTransaction);

module.exports = router;