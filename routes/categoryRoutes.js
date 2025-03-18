const express = require('express');
const router = express.Router();
const {
  getAllCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  countCategories
} = require('../controllers/categoryController');
const auth = require('../middleware/authMiddleware');

// Áp dụng middleware protect cho tất cả routes
router.use(auth);

// Định nghĩa các routes
router
  .route('/')
  .get(getAllCategories)
  .post(createCategory);

// Route đếm số lượng category
router.get('/count', countCategories);

router
  .route('/:id')
  .get(getCategory)
  .put(updateCategory)
  .delete(deleteCategory);

module.exports = router;