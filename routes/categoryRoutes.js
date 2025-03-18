const express = require('express');
const router = express.Router();
const {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
} = require('../controllers/categoryController');
const auth = require('../middleware/authMiddleware');

// Áp dụng middleware protect cho tất cả routes
router.use(auth);

// Định nghĩa các routes
router
  .route('/')
  .get(getCategories)
  .post(createCategory);

router
  .route('/:id')
  .get(getCategoryById)
  .put(updateCategory)
  .delete(deleteCategory);

module.exports = router;