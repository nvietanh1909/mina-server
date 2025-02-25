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

    // Lấy tất cả giao dịch của user
    const allTransactions = await Transaction.find({ userId })
      .sort({ date: -1 }); // Sắp xếp theo thời gian mới nhất

    // Tính tổng thu chi tháng này
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const monthlyStats = allTransactions
      .filter(trans => trans.date >= startOfMonth && trans.date <= endOfMonth)
      .reduce((acc, trans) => {
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
      monthlyStats,
      transactions: allTransactions
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
          content: `Bạn là một trợ lý tài chính thông minh, giúp người dùng quản lý chi tiêu hiệu quả.
          
          Thông tin tài chính hiện tại:
          - Số dư hiện tại: ${walletInfo.balance.toLocaleString('vi-VN')} VND
          - Tổng thu nhập tháng này: ${walletInfo.monthlyStats.totalIncome.toLocaleString('vi-VN')} VND
          - Tổng chi tiêu tháng này: ${walletInfo.monthlyStats.totalExpense.toLocaleString('vi-VN')} VND
    
          QUAN TRỌNG - Quy tắc xử lý tin nhắn:
          1. Khi người dùng nhắn về một khoản tiền, hãy tự động nhận diện và tạo giao dịch:
             - "Được chuyển 1tr tiền lương" → Tạo giao dịch thu (income)
             - "Nạp 200k ví" → Tạo giao dịch thu (income)
    
          2. Với mỗi giao dịch, tự động phân loại category phù hợp:
             
          Nếu phát hiện giao dịch trong tin nhắn, trả về JSON:
          {
            "isTransaction": true,
            "type": "income/expense",
            "amount": number, (luôn trả về tiền việt nam đồng)
            "notes": "ghi chú giao dịch",
            "category": "category phù hợp" 
          }
    
          Lịch sử giao dịch:
          ${walletInfo.transactions.map(trans => 
            `- ${trans.type === 'income' ? 'Thu' : 'Chi'}: ${trans.amount.toLocaleString('vi-VN')} VND - ${trans.notes} (${new Date(trans.date).toLocaleDateString('vi-VN')})`
          ).join('\n')}
    
          Với các câu hỏi khác, trả về text bình thường bằng tiếng Việt.
          Phân tích và lời khuyên dựa trên dữ liệu giao dịch của người dùng.`
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

    // Kiểm tra xem response có phải là JSON hay không
    if (botResponse.trim().startsWith('{')) {
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
      }
    } else {
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