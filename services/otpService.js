const nodemailer = require('nodemailer');
const crypto = require('crypto');

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

      // Lưu trữ OTP trong bộ nhớ
      this.otpStorage = new Map();
    }
  
    // Tạo mã OTP 6 chữ số
    generateOTP() {
      return crypto.randomInt(100000, 999999).toString();
    }
  
    // Lưu OTP vào bộ nhớ thay vì Firebase
    async saveOTP(email, otp) {
      try {
        const currentTime = new Date();
        const expiryTime = new Date(currentTime.getTime() + 10 * 60 * 1000); // 10 phút
        
        const otpData = {
          otp: otp,
          createdAt: currentTime,
          expiresAt: expiryTime
        };
        
        // Lưu vào Map
        this.otpStorage.set(email, otpData);
        
        // Log thông tin để kiểm tra
        console.log('Đã lưu OTP:');
        console.log('Email:', email);
        console.log('OTP Data:', otpData);
        
        return true;
      } catch (error) {
        console.error('Lỗi khi lưu OTP:', error);
        return false;
      }
    }
  
    // Gửi OTP qua email
    async sendOTPByEmail(email) {
      try {
        // Tạo mã OTP
        const otp = this.generateOTP();
  
        // Lưu OTP vào bộ nhớ
        await this.saveOTP(email, otp);
  
        // Cấu hình email
        const mailOptions = {
          from: {
            name: 'Mina',
            address: process.env.EMAIL_USER
          },
          to: email,
          subject: 'Mã OTP Xác Thực',
          html: `
           <div style="background-color: #f5f5f5; padding: 40px 20px;">
                <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; padding: 40px 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.08);">
                    <!-- Header -->
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #2c3e50; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 24px; font-weight: 600;">
                            Xác Thực Tài Khoản
                        </h1>
                    </div>

                    <!-- Main Content -->
                    <div style="text-align: center;">
                        <p style="color: #4a5568; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.6; margin-bottom: 25px;">
                            Vui lòng sử dụng mã OTP bên dưới để xác thực tài khoản của bạn
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
        // Lấy OTP từ bộ nhớ
        const otpData = this.otpStorage.get(email);
  
        if (!otpData) {
          return { 
            success: false, 
            message: 'Không tìm thấy OTP' 
          };
        }
  
        // Kiểm tra thời gian hết hạn
        const currentTime = new Date();
        const timeDiff = (currentTime - otpData.createdAt) / 1000; // Đổi ra giây
        
        if (timeDiff > 600) { // 10 phút
          // Xóa OTP đã hết hạn
          this.otpStorage.delete(email);
          
          return { 
            success: false, 
            message: 'OTP đã hết hạn' 
          };
        }
  
        if (otpData.otp !== userProvidedOTP) {
          return { 
            success: false, 
            message: 'OTP không chính xác' 
          };
        }
  
        // Xóa OTP sau khi xác thực thành công
        this.otpStorage.delete(email);
  
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