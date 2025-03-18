const mongoose = require('mongoose');

// Schema cho icon
const iconSchema = new mongoose.Schema({
  iconPath: {
    type: String,
    required: [true, 'Icon path is required'],
    trim: true
  },
  color: {
    type: String,
    default: '#000000', // Màu mặc định
    validate: {
      validator: function(value) {
        return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value);
      },
      message: 'Color must be a valid hex color code (e.g. #FF5733)'
    }
  }
});

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    maxlength: [50, 'Category name cannot exceed 50 characters']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true // Thêm index để tăng hiệu suất truy vấn
  },
  icons: {
    type: [iconSchema],
    validate: {
      validator: function(icons) {
        return icons && icons.length > 0;
      },
      message: 'At least one icon is required'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true // Không cho phép thay đổi sau khi tạo
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  // Thêm toJSON option để loại bỏ __v và chuyển đổi _id thành id
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Middleware để tự động cập nhật updatedAt
categorySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Middleware cho findOneAndUpdate
categorySchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: Date.now() });
  next();
});

// Tạo compound index giữa userId và name để tăng tốc truy vấn
categorySchema.index({ userId: 1, name: 1 });

const Category = mongoose.model('Category', categorySchema);
module.exports = Category;
