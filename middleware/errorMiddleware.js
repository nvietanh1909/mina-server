const errorMiddleware = (err, req, res, next) => {
    // Log lỗi
    console.error(err.stack);
  
    // Ghi log vào file
    const fs = require('fs');
    const errorLog = `${new Date().toISOString()} - ${err.stack}\n`;
    fs.appendFile('logs/error.log', errorLog, (logErr) => {
      if (logErr) console.error('Không thể ghi vào file log', logErr);
    });
  
    // Trả về response lỗi
    res.status(err.status || 500).json({
      status: 'error',
      message: err.message || 'Đã xảy ra lỗi không xác định',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  };
  
  module.exports = errorMiddleware;