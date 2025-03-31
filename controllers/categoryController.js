const Category = require('../models/categoryModel');

const categoryController = {
  createCategory: async (req, res) => {
    try {
      const { name, description, icon, color, icons } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Name is required'
        });
      }

      const category = await Category.create({
        name,
        description,
        icon,
        color,
        icons,
        userId: req.user.id,
        isDefault: false
      });

      res.status(201).json({
        success: true,
        data: category
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Đã tồn tại category với tên này'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to create category',
        error: error.message
      });
    }
  },

  getCategories: async (req, res) => {
    try {
      // Lấy cả category mặc định và category của user
      const categories = await Category.find({
        $or: [
          { isDefault: true },
          { userId: req.user.id }
        ]
      });
      res.status(200).json({
        success: true,
        data: categories
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get categories',
        error: error.message
      });
    }
  },

  getCategoryById: async (req, res) => {
    try {
      const category = await Category.findOne({
        _id: req.params.id,
        $or: [
          { isDefault: true },
          { userId: req.user.id }
        ]
      });

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      res.status(200).json({
        success: true,
        data: category
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get category',
        error: error.message
      });
    }
  },

  updateCategory: async (req, res) => {
    try {
      // Chỉ cho phép cập nhật category không phải mặc định
      const category = await Category.findOne({
        _id: req.params.id,
        userId: req.user.id,
        isDefault: false
      });

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found or cannot be updated'
        });
      }

      const updatedCategory = await Category.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );

      res.status(200).json({
        success: true,
        data: updatedCategory
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Đã tồn tại category với tên này'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to update category',
        error: error.message
      });
    }
  },

  deleteCategory: async (req, res) => {
    try {
      // Chỉ cho phép xóa category không phải mặc định
      const category = await Category.findOne({
        _id: req.params.id,
        userId: req.user.id,
        isDefault: false
      });

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found or cannot be deleted'
        });
      }

      await Category.findByIdAndDelete(req.params.id);

      res.status(200).json({
        success: true,
        message: 'Category deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to delete category',
        error: error.message
      });
    }
  }
};

module.exports = categoryController;