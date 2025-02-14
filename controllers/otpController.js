const OTPService = require('../services/otpService');
const otpService = new OTPService();

const otpController = {
  sendOTP: async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email là bắt buộc'
        });
      }

      const result = await otpService.sendOTPByEmail(email);
      res.status(200).json(result);
    } catch (error) {
      console.error('Lỗi trong sendOTP controller:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  },

  verifyOTP: async (req, res) => {
    try {
      const { email, otp } = req.body;
      
      if (!email || !otp) {
        return res.status(400).json({
          success: false,
          message: 'Email và OTP là bắt buộc'
        });
      }

      const result = await otpService.verifyOTP(email, otp);
      res.status(200).json(result);
    } catch (error) {
      console.error('Lỗi trong verifyOTP controller:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }
};

module.exports = otpController;