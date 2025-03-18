const User = require('../models/userModel');
const Wallet = require('../models/walletModel');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Category = require('../models/categoryModel');

// Tách hàm tạo token thành hàm riêng để tái sử dụng
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d'
  });
};

// Tạo hàm xử lý lỗi chung để tránh lặp code
const handleError = (res, statusCode, message) => {
  return res.status(statusCode).json({
    status: 'error',
    message
  });
};

// Tạo hàm định dạng dữ liệu người dùng để tái sử dụng
const formatUserResponse = (user) => {
  return {
    id: user._id,
    email: user.email,
    name: user.name
  };
};

// Dữ liệu danh mục mặc định
const DEFAULT_CATEGORIES = [
  {
    name: 'Food',
    icons: [
      { iconPath: '🍔', color: '#FF5733' },
      { iconPath: '🍕', color: '#FF5733' },
      { iconPath: '🍣', color: '#FF5733' },
      { iconPath: '🍜', color: '#FF5733' },
      { iconPath: '🍦', color: '#FF5733' },
      { iconPath: '🍪', color: '#FF5733' }
    ]
  },
  {
    name: 'Transport',
    icons: [
      { iconPath: '🚗', color: '#33FF57' },
      { iconPath: '🚕', color: '#33FF57' },
      { iconPath: '🚲', color: '#33FF57' },
      { iconPath: '🚄', color: '#33FF57' },
      { iconPath: '🚌', color: '#33FF57' },
      { iconPath: '🚀', color: '#33FF57' }
    ]
  },
  {
    name: 'Shopping',
    icons: [
      { iconPath: '👗', color: '#3357FF' },
      { iconPath: '👠', color: '#3357FF' },
      { iconPath: '👒', color: '#3357FF' },
      { iconPath: '👜', color: '#3357FF' },
      { iconPath: '🕶️', color: '#3357FF' },
      { iconPath: '🧥', color: '#3357FF' }
    ]
  },
  {
    name: 'Entertainment',
    icons: [
      { iconPath: '🎬', color: '#FF33F6' },
      { iconPath: '🎤', color: '#FF33F6' },
      { iconPath: '🎮', color: '#FF33F6' },
      { iconPath: '🎳', color: '#FF33F6' },
      { iconPath: '🎭', color: '#FF33F6' },
      { iconPath: '🎨', color: '#FF33F6' }
    ]
  },
  {
    name: 'Health',
    icons: [
      { iconPath: '💊', color: '#33FFF6' },
      { iconPath: '🩺', color: '#33FFF6' },
      { iconPath: '🌡️', color: '#33FFF6' },
      { iconPath: '💉', color: '#33FFF6' },
      { iconPath: '🧴', color: '#33FFF6' },
      { iconPath: '🚑', color: '#33FFF6' }
    ]
  },
  {
    name: 'Education',
    icons: [
      { iconPath: '📚', color: '#F6FF33' },
      { iconPath: '🎓', color: '#F6FF33' },
      { iconPath: '📝', color: '#F6FF33' },
      { iconPath: '📐', color: '#F6FF33' },
      { iconPath: '📏', color: '#F6FF33' },
      { iconPath: '📖', color: '#F6FF33' }
    ]
  }
];

// Đăng ký người dùng
exports.register = async (req, res) => {
  const session = await User.startSession();
  session.startTransaction();
  
  try {
    const { email, password, name } = req.body;

    // Kiểm tra trường bắt buộc
    if (!email || !password || !name) {
      return handleError(res, 400, 'Please provide email, password and name');
    }

    // Kiểm tra email đã tồn tại
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return handleError(res, 400, 'Email is already in use');
    }

    // Tạo người dùng
    const user = await User.create([{
      email,
      password,
      name
    }], { session });

    // Tạo ví mặc định
    const wallet = await Wallet.create([{
      userId: user[0]._id,
      name: "Wallet",
      balance: 0,
      monthlyLimit: 1000000,
      isDefault: true
    }], { session });

    // Tạo danh mục mặc định
    const categoryData = DEFAULT_CATEGORIES.map(category => ({
      ...category,
      userId: user[0]._id
    }));
    
    const categories = await Category.create(categoryData, { session });

    // Tạo token
    const token = generateToken(user[0]._id);

    // Hoàn tất giao dịch
    await session.commitTransaction();

    // Trả về kết quả
    res.status(201).json({
      status: 'success',
      data: {
        user: formatUserResponse(user[0]),
        wallet: {
          id: wallet[0]._id,
          name: wallet[0].name,
          balance: wallet[0].balance
        },
        categories: categories.map(cat => ({
          id: cat._id,
          name: cat.name,
          icons: cat.icons
        })),
        token
      }
    });
  } catch (error) {
    // Nếu có lỗi, hủy giao dịch
    await session.abortTransaction();
    console.error('Registration error:', error);
    handleError(res, 500, error.message || 'An error occurred during registration');
  } finally {
    // Kết thúc phiên
    session.endSession();
  }
};

// Đăng nhập
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return handleError(res, 400, 'Please enter both email and password');
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return handleError(res, 401, 'Incorrect email or password');
    }

    const token = generateToken(user._id);

    res.status(200).json({
      status: 'success',
      data: {
        user: formatUserResponse(user),
        token
      }
    });
  } catch (error) {
    handleError(res, 400, error.message);
  }
};

// Cập nhật thông tin cá nhân
exports.updateProfile = async (req, res) => {
  try {
    const { name, currentPassword, newPassword } = req.body;
    const updateData = {};

    // Cập nhật tên nếu có
    if (name) {
      updateData.name = name;
    }

    // Cập nhật mật khẩu nếu có
    if (currentPassword && newPassword) {
      const user = await User.findById(req.user.id).select('+password');
      
      if (!user || !(await user.comparePassword(currentPassword))) {
        return handleError(res, 400, 'Current password is incorrect');
      }

      if (newPassword.length < 6) {
        return handleError(res, 400, 'New password must be at least 6 characters long');
      }

      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(newPassword, salt);
    }

    // Không có thay đổi gì
    if (Object.keys(updateData).length === 0) {
      return handleError(res, 400, 'No update data provided');
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true }
    );

    if (!user) {
      return handleError(res, 404, 'User not found');
    }

    res.status(200).json({
      status: 'success',
      data: {
        user: formatUserResponse(user)
      }
    });
  } catch (error) {
    handleError(res, 400, error.message);
  }
};

// Lấy thông tin cá nhân
exports.getProfile = async (req, res) => {
  try {
    // Sửa lại req.userId thành req.user.id để thống nhất
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return handleError(res, 404, 'User not found');
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        user: formatUserResponse(user)
      }
    });
  } catch (error) {
    handleError(res, 400, error.message);
  }
};
