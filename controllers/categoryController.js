const Category = require('../models/categoryModel');

exports.createCategory = async (req, res) => {
  try {
    const { name, icon, type } = req.body;

    const category = await Category.create({
      name,
      icon: icon || 'default-icon',
      type,
      userId: req.user.id
    });

    res.status(201).json({
      status: 'success',
      data: {
        category
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        status: 'error',
        message: 'Đã tồn tại danh mục này'
      });
    }

    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const { type } = req.query;

    const query = { userId: req.user.id };
    if (type) query.type = type;

    const categories = await Category.find(query);

    res.status(200).json({
      status: 'success',
      results: categories.length,
      data: {
        categories
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon } = req.body;

    const category = await Category.findOneAndUpdate(
      { 
        _id: id, 
        userId: req.user.id 
      },
      { 
        name, 
        icon: icon || 'default-icon' 
      },
      { 
        new: true, 
        runValidators: true 
      }
    );

    if (!category) {
      return res.status(404).json({
        status: 'error',
        message: 'Không tìm thấy danh mục'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        category
      }
    });
  } catch (error) {
    // Xử lý lỗi trùng tên category
    if (error.code === 11000) {
      return res.status(400).json({
        status: 'error',
        message: 'Đã tồn tại danh mục này'
      });
    }

    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findOneAndDelete({ 
      _id: id, 
      userId: req.user.id 
    });

    if (!category) {
      return res.status(404).json({
        status: 'error',
        message: 'Không tìm thấy danh mục'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Xóa danh mục thành công'
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
};

exports.getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findOne({ 
      _id: id, 
      userId: req.user.id 
    });

    if (!category) {
      return res.status(404).json({
        status: 'error',
        message: 'Không tìm thấy danh mục'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        category
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
};