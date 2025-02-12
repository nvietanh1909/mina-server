const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  icon: {
    type: String,
    default: 'assets/icons/food.png',
    validate: {
      validator: function(v) {
        return v.startsWith('assets/icons/') && v.endsWith('.png');
      },
      message: props => `${props.value}`
    }
  },
  type: {
    type: String,
    enum: ['income', 'expense'],
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Mỗi user chỉ có một category với tên duy nhất
categorySchema.index({ userId: 1, name: 1 }, { unique: true });

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;