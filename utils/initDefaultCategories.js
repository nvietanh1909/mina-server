const mongoose = require('mongoose');
const Category = require('../models/categoryModel');
const defaultCategories = require('./defaultCategories');

const initDefaultCategories = async () => {
  try {
    // Kiểm tra xem đã có category mặc định chưa
    const existingDefaultCategory = await Category.findOne({ isDefault: true });
    if (existingDefaultCategory) {
      console.log('Default categories already exist');
      return;
    }

    // Tạo category mặc định
    const defaultCategory = await Category.create({
      ...defaultCategories[0],
      isDefault: true,
      userId: null // Category mặc định không thuộc về user nào
    });

    console.log('Default category created successfully');
  } catch (error) {
    console.error('Error initializing default categories:', error);
    throw error;
  }
};

module.exports = initDefaultCategories; 