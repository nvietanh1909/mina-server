const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Định nghĩa các route
router.post('/', categoryController.createCategory);
router.get('/', categoryController.getCategories);
router.get('/:id', categoryController.getCategoryById);
router.patch('/:id', categoryController.updateCategory);
router.delete('/:id', categoryController.deleteCategory);

module.exports = router;