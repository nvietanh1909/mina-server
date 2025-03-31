const Chatbot = require('../models/chatbotModel');
const Transaction = require('../models/transactionModel');
const Wallet = require('../models/walletModel');
const { OpenAI } = require('openai');
const mongoose = require('mongoose');
const Category = require('../models/categoryModel');

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

// Helper function để lấy danh sách category
async function getCategories(userId) {
  try {
    const categories = await Category.find({
      $or: [
        { userId },
        { isDefault: true }
      ]
    });
    return categories;
  } catch (error) {
    console.error('Get categories error:', error);
    return [];
  }
}

// Helper function để trích xuất JSON từ response
function extractJSON(text) {
  try {
    // Tìm vị trí bắt đầu và kết thúc của JSON object
    const startIndex = text.indexOf('{');
    const endIndex = text.lastIndexOf('}') + 1;
    
    if (startIndex === -1 || endIndex === 0) {
      return null;
    }

    // Trích xuất chuỗi JSON
    const jsonStr = text.substring(startIndex, endIndex);
    
    // Parse JSON
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('JSON extraction error:', error);
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

    // Lấy danh sách category
    const categories = await getCategories(userId);
    const categoryNames = categories.map(cat => cat.name);

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

          Danh sách category hiện có:
          ${categoryNames.join(', ')}
    
          QUAN TRỌNG - Quy tắc xử lý tin nhắn:
          1. Khi người dùng nhắn về một khoản tiền, hãy tự động nhận diện và tạo giao dịch:
             - "Được chuyển 1tr tiền lương" → Tạo giao dịch thu (income)
             - "Nạp 200k ví" → Tạo giao dịch thu (income)
             - "Chi 50k ăn trưa ngày 15/3" → Tạo giao dịch với ngày được chỉ định
    
          2. Với mỗi giao dịch, tự động phân loại category phù hợp. CHỈ sử dụng các category có trong danh sách trên.
             
          Nếu phát hiện giao dịch trong tin nhắn, CHỈ trả về JSON với định dạng sau và KHÔNG kèm theo bất kỳ text nào khác:
          {
            "isTransaction": true,
            "type": "income/expense",
            "amount": number,
            "notes": "ghi chú giao dịch (bằng tiếng anh từ 1 - 5 từ)",
            "category": "PHẢI là một trong các category trong danh sách trên",
            "date": "YYYY-MM-DD" // Nếu người dùng chỉ định ngày, sử dụng ngày đó. Nếu không, để trống trường này
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

    // Kiểm tra và parse JSON từ response
    const parsedResponse = extractJSON(botResponse);
    
    if (parsedResponse && parsedResponse.isTransaction) {
      // Kiểm tra số dư khi chi tiêu
      if (parsedResponse.type === 'expense' && walletInfo.balance < parsedResponse.amount) {
        responseMessage = 'Số dư trong ví không đủ để thực hiện giao dịch này.';
      } else {
        // Kiểm tra category tồn tại
        const categoryInfo = await Category.findOne({ 
          $or: [
            { name: parsedResponse.category, userId },
            { name: parsedResponse.category, isDefault: true }
          ]
        }).session(session);

        if (!categoryInfo) {
          // Lấy danh sách category hiện có cho loại giao dịch này
          const existingCategories = await Category.find({
            $or: [
              { userId },
              { isDefault: true }
            ]
          }).session(session);

          // Lọc category phù hợp với loại giao dịch (income/expense)
          const suggestedCategories = existingCategories
            .filter(cat => {
              // Các category thường dùng cho income
              const incomeKeywords = ['salary', 'lương', 'thu nhập', 'bonus', 'thưởng', 'investment', 'đầu tư'];
              // Các category thường dùng cho expense
              const expenseKeywords = ['food', 'ăn', 'transport', 'đi lại', 'shopping', 'mua sắm', 'bill', 'hóa đơn'];
              
              const name = cat.name.toLowerCase();
              if (parsedResponse.type === 'income') {
                return incomeKeywords.some(keyword => name.includes(keyword.toLowerCase()));
              } else {
                return expenseKeywords.some(keyword => name.includes(keyword.toLowerCase()));
              }
            })
            .map(cat => ({
              name: cat.name,
              icons: cat.icons.map(icon => icon.iconPath)
            }));

          await session.abortTransaction();
          return res.status(200).json({
            success: true,
            data: {
              needNewCategory: true,
              message: `Danh mục "${parsedResponse.category}" chưa tồn tại. Bạn có muốn tạo danh mục mới không?\n\nCác danh mục gợi ý cho giao dịch ${parsedResponse.type === 'income' ? 'thu nhập' : 'chi tiêu'}:\n${suggestedCategories.map(cat => cat.name).join('\n')}\n\nHoặc bạn có thể tạo danh mục mới với tên "${parsedResponse.category}"`,
              suggestedCategories,
              transactionData: {
                amount: parsedResponse.amount,
                notes: parsedResponse.notes,
                type: parsedResponse.type,
                category: parsedResponse.category
              }
            }
          });
        }

        // Lấy danh sách icons từ category
        const availableIcons = categoryInfo.icons.map(icon => icon.iconPath);
        
        // Gọi OpenAI để chọn icon phù hợp
        const iconCompletion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: `Bạn là một trợ lý chọn icon thông minh. Dựa vào nội dung giao dịch, hãy chọn icon phù hợp nhất từ danh sách có sẵn.
              
              Danh sách icon có sẵn: ${availableIcons.join(', ')}
              
              CHỈ trả về một icon duy nhất từ danh sách trên, KHÔNG kèm theo bất kỳ text nào khác.`
            },
            {
              role: "user",
              content: parsedResponse.notes
            }
          ],
          max_tokens: 10,
          temperature: 0.3
        });

        const selectedIcon = iconCompletion.choices[0].message.content.trim();
        
        // Kiểm tra xem icon được chọn có trong danh sách không
        const icon = availableIcons.includes(selectedIcon) ? selectedIcon : availableIcons[0];

        // Tạo transaction mới với ngày từ parsedResponse nếu có
        const transactionDate = parsedResponse.date ? new Date(parsedResponse.date) : new Date();
        
        transaction = await Transaction.create([{
          userId,
          walletId: walletInfo.walletId,
          amount: parsedResponse.amount,
          notes: parsedResponse.notes,
          category: parsedResponse.category,
          icon: icon,
          type: parsedResponse.type,
          date: transactionDate
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