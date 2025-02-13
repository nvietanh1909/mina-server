const Chatbot = require('../models/chatbotModel');
const Transaction = require('../models/transactionModel');
const Wallet = require('../models/walletModel');
const { OpenAI } = require('openai');
const mongoose = require('mongoose');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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

    // Tìm ví của user
    const wallet = await Wallet.findOne({ userId }).session(session);
    if (!wallet) {
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
          Nếu người dùng muốn thêm một khoản thu/chi, hãy phân tích và trả về JSON với format sau:
          {
            "isTransaction": true,
            "type": "income/expense",
            "amount": number,
            "notes": "ghi chú"
          }
          Nếu không phải yêu cầu thêm giao dịch, trả về:
          {
            "isTransaction": false,
            "message": "câu trả lời của bạn"
          }`
        },
        {
          role: "user",
          content: message
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    const botResponse = completion.choices[0].message.content;
    let responseMessage = '';
    let transaction = null;

    try {
      const parsedResponse = JSON.parse(botResponse);
      
      if (parsedResponse.isTransaction) {
        // Kiểm tra số dư khi chi tiêu
        if (parsedResponse.type === 'expense' && wallet.balance < parsedResponse.amount) {
          responseMessage = 'Số dư trong ví không đủ để thực hiện giao dịch này.';
        } else {
          // Tạo transaction mới
          transaction = await Transaction.create([{
            userId,
            walletId: wallet._id,
            amount: parsedResponse.amount,
            notes: parsedResponse.notes,
            category: "food",
            type: parsedResponse.type,
            date: new Date()
          }], { session });

          // Cập nhật số dư ví
          const updateAmount = parsedResponse.type === 'income' ? parsedResponse.amount : -parsedResponse.amount;
          await Wallet.findByIdAndUpdate(
            wallet._id,
            { $inc: { balance: updateAmount } },
            { session }
          );

          responseMessage = `Đã thêm giao dịch thành công: ${parsedResponse.amount} ${parsedResponse.type === 'income' ? 'thu nhập' : 'chi tiêu'} cho ${parsedResponse.notes}`;
        }
      } else {
        responseMessage = parsedResponse.message;
      }
    } catch (error) {
      console.error('Parse response error:', error);
      responseMessage = 'Xin lỗi, tôi không hiểu yêu cầu của bạn. Vui lòng thử lại.';
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
        transaction: transaction ? transaction[0] : null
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