const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  icon: {
    type: String,
    trim: true
  },
  color: {
    type: String,
    trim: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return !this.isDefault; // userId chỉ required khi không phải category mặc định
    }
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  icons: [{
    iconPath: {
      type: String,
      required: true
    },
    color: {
      type: String,
      default: '#000000' // Màu mặc định
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Tạo compound index để đảm bảo tên category chỉ unique trong phạm vi của một user và không phải category mặc định
categorySchema.index(
  { name: 1, userId: 1 }, 
  { 
    unique: true,
    partialFilterExpression: { 
      userId: { $exists: true },  // Chỉ áp dụng khi có userId
      isDefault: { $eq: false }   // Và không phải category mặc định
    } 
  }
);

// Middleware để tự động cập nhật updatedAt
categorySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Category = mongoose.model('Category', categorySchema);
module.exports = Category;
