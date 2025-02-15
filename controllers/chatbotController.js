const Chatbot = require('../models/chatbotModel');
const Transaction = require('../models/transactionModel');
const Wallet = require('../models/walletModel');
const { OpenAI } = require('openai');
const mongoose = require('mongoose');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Helper function để lấy thông tin ví và giao dịch
async function getWalletInfo(userId) {
  try {
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) return null;

    // Lấy ngày đầu tháng và cuối tháng
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Lấy tất cả giao dịch trong tháng
    const transactions = await Transaction.find({
      userId,
      date: { $gte: startOfMonth, $lte: endOfMonth }
    });

    // Tính tổng thu chi
    const stats = transactions.reduce((acc, trans) => {
      if (trans.type === 'income') {
        acc.totalIncome += trans.amount;
      } else {
        acc.totalExpense += trans.amount;
      }
      return acc;
    }, { totalIncome: 0, totalExpense: 0 });

    return {
      balance: wallet.balance,
      walletId: wallet._id,
      monthlyStats: stats
    };
  } catch (error) {
    console.error('Get wallet info error:', error);
    return null;
  }
}

exports.generateResponse = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { message, userId } = req.body;

    if (!message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Message is required' 
      });
    }

    // Lấy thông tin ví và giao dịch
    const walletInfo = await getWalletInfo(userId);
    if (!walletInfo) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy ví'
      });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `Bạn là một trợ lý tài chính thông minh, gen z, trẻ trung, giúp người dùng quản lý chi tiêu hiệu quả.
          
          Thông tin tài chính hiện tại:
          - Số dư hiện tại: ${walletInfo.balance.toLocaleString('vi-VN')} VND
          - Tổng thu nhập tháng này: ${walletInfo.monthlyStats.totalIncome.toLocaleString('vi-VN')} VND
          - Tổng chi tiêu tháng này: ${walletInfo.monthlyStats.totalExpense.toLocaleString('vi-VN')} VND

          Nếu người dùng muốn thêm một khoản thu/chi, hãy phân tích và trả về JSON với format:
          {
            "isTransaction": true,
            "type": "income/expense",
            "amount": number,
            "notes": "ghi chú"
            "category": "bạn tự cho category phù hợp và ngắn gọn (vd: Food, Bank, Family, Pet...) với câu hỏi người dùng, dùng tiếng anh với category",
          }

          Nếu người dùng hỏi về số dư hoặc thống kê, hãy trả về thông tin từ dữ liệu trên và đưa ra lời khuyên về quản lý tài chính.
          
          Nếu không phải yêu cầu thêm giao dịch, trả về:
          {
            "isTransaction": false,
            "message": "câu trả lời của bạn"
          }
          Nếu người dùng hỏi những câu khác ngoài lề thì bạn cũng có thể trả lời nhé và các câu trả lời đều dùng hoàn toàn là tiếng việt!
          `
        },
        {
          role: "user",
          content: message
        }
      ],
      max_tokens: 1000,
      temperature: 0.7
    });

    const botResponse = completion.choices[0].message.content;
    let responseMessage = '';
    let transaction = null;

    try {
      const parsedResponse = JSON.parse(botResponse);
      
      if (parsedResponse.isTransaction) {
        // Kiểm tra số dư khi chi tiêu
        if (parsedResponse.type === 'expense' && walletInfo.balance < parsedResponse.amount) {
          responseMessage = 'Số dư trong ví không đủ để thực hiện giao dịch này.';
        } else {
          // Tạo transaction mới
          transaction = await Transaction.create([{
            userId,
            walletId: walletInfo.walletId,
            amount: parsedResponse.amount,
            notes: parsedResponse.notes,
            category: parsedResponse.category,
            type: parsedResponse.type,
            date: new Date()
          }], { session });

          // Cập nhật số dư ví
          const updateAmount = parsedResponse.type === 'income' ? parsedResponse.amount : -parsedResponse.amount;
          await Wallet.findByIdAndUpdate(
            walletInfo.walletId,
            { $inc: { balance: updateAmount } },
            { session }
          );

          responseMessage = `Đã thêm giao dịch thành công: ${parsedResponse.amount.toLocaleString('vi-VN')} VND ${parsedResponse.type === 'income' ? 'thu nhập' : 'chi tiêu'} cho ${parsedResponse.notes}`;
        }
      } else {
        responseMessage = parsedResponse.message;
      }
    } catch (error) {
      console.error('Parse response error:', error);
      responseMessage = botResponse; 
    }

    // Lưu cuộc hội thoại vào database
    const chatbot = await Chatbot.create([{
      userId,
      message,
      response: responseMessage
    }], { session });

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      data: {
        message,
        response: responseMessage,
        transaction: transaction ? transaction[0] : null,
        balance: walletInfo.balance,
        monthlyStats: walletInfo.monthlyStats
      }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Chatbot error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// Lấy lịch sử chat của user
exports.getChatHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const history = await Chatbot.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20);

    res.status(200).json({
      success: true,
      data: history
    });

  } catch (error) {
    console.error('Get chat history error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};