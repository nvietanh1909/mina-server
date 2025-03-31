const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    index: true
  },
  otp: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600 // Tự động xóa sau 10 phút
  },
  attempts: {
    type: Number,
    default: 0
  },
  isVerified: {
    type: Boolean,
    default: false
  }
});

// Index để tối ưu truy vấn
otpSchema.index({ email: 1, createdAt: -1 });

const OTP = mongoose.model('OTP', otpSchema);

module.exports = OTP; 