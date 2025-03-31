const nodemailer = require('nodemailer');
const crypto = require('crypto');
const OTP = require('../models/otpModel');
const User = require('../models/userModel');

class OTPService {
    constructor() {
      // Khởi tạo nodemailer transporter
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
    }
  
    // Tạo mã OTP 6 chữ số
    generateOTP() {
      return crypto.randomInt(100000, 999999).toString();
    }

    // Validate email format
    validateEmail(email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    }

    // Kiểm tra email tồn tại
    async checkEmailExists(email) {
      try {
        const user = await User.findOne({ email: email.toLowerCase() });
        return user !== null;
      } catch (error) {
        console.error('Lỗi khi kiểm tra email:', error);
        return false;
      }
    }
  
    // Lưu OTP vào database
    async saveOTP(email, otp) {
      try {
        // Xóa các OTP cũ của email này
        await OTP.deleteMany({ email });
        
        // Tạo OTP mới
        const otpData = new OTP({
          email,
          otp,
          createdAt: new Date()
        });
        
        await otpData.save();
        
        // Log thông tin để kiểm tra
        console.log('Đã lưu OTP:', {
          email,
          otpId: otpData._id,
          createdAt: otpData.createdAt
        });
        
        return true;
      } catch (error) {
        console.error('Lỗi khi lưu OTP:', error);
        return false;
      }
    }
  
    // Gửi OTP qua email
    async sendOTPByEmail(email, isRegistration = false) {
      try {
        // Validate email
        if (!this.validateEmail(email)) {
          return {
            success: false,
            message: 'Email không hợp lệ'
          };
        }

        // Kiểm tra email tồn tại
        const emailExists = await this.checkEmailExists(email);
        if (isRegistration && emailExists) {
          return {
            success: false,
            message: 'Email đã được sử dụng. Vui lòng sử dụng email khác.'
          };
        }
        if (!isRegistration && !emailExists) {
          return {
            success: false,
            message: 'Email chưa được đăng ký. Vui lòng đăng ký tài khoản trước.'
          };
        }

        // Tạo mã OTP
        const otp = this.generateOTP();
  
        // Lưu OTP vào database
        const saved = await this.saveOTP(email, otp);
        if (!saved) {
          return {
            success: false,
            message: 'Không thể lưu OTP'
          };
        }
  
        // Cấu hình email
        const mailOptions = {
          from: {
            name: 'Mina',
            address: process.env.EMAIL_USER
          },
          to: email,
          subject: isRegistration ? 'Mã OTP Đăng Ký Tài Khoản' : 'Mã OTP Xác Thực',
          html: `
           <div style="background-color: #f5f5f5; padding: 40px 20px;">
                <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; padding: 40px 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.08);">
                    <!-- Header -->
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #2c3e50; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 24px; font-weight: 600;">
                            ${isRegistration ? 'Đăng Ký Tài Khoản' : 'Xác Thực Tài Khoản'}
                        </h1>
                    </div>

                    <!-- Main Content -->
                    <div style="text-align: center;">
                        <p style="color: #4a5568; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.6; margin-bottom: 25px;">
                            Vui lòng sử dụng mã OTP bên dưới để ${isRegistration ? 'đăng ký' : 'xác thực'} tài khoản của bạn
                        </p>
                        
                        <!-- OTP Box -->
                        <div style="background-color: #f8fafc; padding: 20px; border-radius: 6px; border: 1px solid #e2e8f0; margin: 25px 0;">
                            <h2 style="color: #1a202c; font-family: 'Courier New', monospace; letter-spacing: 8px; font-size: 32px; margin: 0; font-weight: 600;">
                                ${otp}
                            </h2>
                        </div>

                        <!-- Timer -->
                        <p style="color: #64748b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; margin: 15px 0;">
                            ⏰ Mã có hiệu lực trong 10 phút
                        </p>

                        <!-- Security Note -->
                        <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                            <p style="color: #64748b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; line-height: 1.5; margin: 0; text-align: center;">
                                🔒 Không chia sẻ mã này với bất kỳ ai, kể cả nhân viên Mina
                            </p>
                        </div>
                    </div>
                </div>
            </div>
          `
        };
  
        // Gửi email
        const sendResult = await this.transporter.sendMail(mailOptions);
        console.log('Chi tiết gửi email:', sendResult);
  
        return { 
          success: true, 
          message: 'OTP đã được gửi thành công',
          messageId: sendResult.messageId
        };
      } catch (error) {
        console.error('Lỗi khi gửi OTP:', error);
        return { 
          success: false, 
          message: 'Không thể gửi OTP',
          error: error.message 
        };
      }
    }
  
    // Xác thực OTP
    async verifyOTP(email, userProvidedOTP) {
      try {
        // Lấy OTP từ database
        const otpData = await OTP.findOne({ 
          email,
          isVerified: false
        }).sort({ createdAt: -1 });

        if (!otpData) {
          return { 
            success: false, 
            message: 'Không tìm thấy OTP hoặc OTP đã được sử dụng' 
          };
        }

        // Tăng số lần thử
        otpData.attempts += 1;
        await otpData.save();

        // Kiểm tra số lần thử
        if (otpData.attempts > 3) {
          await OTP.deleteOne({ _id: otpData._id });
          return {
            success: false,
            message: 'Quá nhiều lần thử không thành công. Vui lòng yêu cầu mã OTP mới.'
          };
        }

        // Kiểm tra OTP
        if (otpData.otp !== userProvidedOTP) {
          return { 
            success: false, 
            message: 'OTP không chính xác' 
          };
        }

        // Đánh dấu OTP đã được xác thực
        otpData.isVerified = true;
        await otpData.save();

        return { 
          success: true, 
          message: 'OTP xác thực thành công' 
        };
      } catch (error) {
        console.error('Lỗi khi xác thực OTP:', error);
        return { 
          success: false, 
          message: 'Lỗi xác thực OTP',
          error: error.message 
        };
      }
    }
  }
  
module.exports = OTPService;