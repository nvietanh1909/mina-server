const { OpenAI } = require('openai');
const Category = require('../models/categoryModel');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Helper function để lấy ngày hiện tại theo định dạng YYYY-MM-DD
function getCurrentDate() {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

// Helper function để lấy ngày mai theo định dạng YYYY-MM-DD
function getTomorrowDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

// Helper function để lấy ngày hôm qua theo định dạng YYYY-MM-DD
function getYesterdayDate() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

// Helper function để chuyển đổi định dạng ngày từ YYYY-MM-DD sang DD MMM YYYY
function formatDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate().toString().padStart(2, '0')} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

exports.analyzeBill = async (req, res) => {
  try {
    const { text, userId } = req.body;

    if (!text) {  
      return res.status(400).json({
        success: false,
        message: 'OCR text is required'
      });
    }

    // Lấy các ngày tham chiếu
    const today = getCurrentDate();
    const tomorrow = getTomorrowDate();
    const yesterday = getYesterdayDate();

    // Lấy danh sách category
    const categories = await Category.find({
      $or: [
        { userId },
        { isDefault: true }
      ]
    });
    const categoryNames = categories.map(cat => cat.name);

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `Bạn là một hệ thống phân tích hóa đơn thông minh, có khả năng đọc hiểu hóa đơn, đa ngôn ngữ và chuyển đổi tiền tệ toàn bộ sang Việt Nam.

            Nhiệm vụ của bạn là:
            1. Phân tích và làm sạch text đầu vào để tìm số tiền:
               - Nếu text có "X ngan", "X ngàn" => X * 1000 VND
               - Nếu text có "X trieu", "X triệu" => X * 1000000 VND
               - Nếu text có "X k" => X * 1000 VND
               - Nếu text có "X đ", "X d", "X vnd", "X VND" => X VND
               - Nếu text có số tiền bằng tiền nước ngoài, quy đổi sang VND theo tỷ giá hiện tại
               VD: 
               - "100 ngan" => 100000
               - "1 trieu" => 1000000
               - "50k" => 50000
               - "15 usd" => 15 * tỷ giá USD hiện tại

            2. Phân loại hóa đơn vào các danh mục dựa vào text cho hợp lý theo ngữ cảnh
            3. Tạo ghi chú ngắn gọn mô tả nội dung chính của hóa đơn
            4. Xử lý ngày tháng:
               - Nếu text có "hom nay" hoặc "ngày này" => ${today}
               - Nếu text có "ngay mai" hoặc "mai" => ${tomorrow}
               - Nếu text có "hom qua" => ${yesterday}
               - Nếu text có ngày cụ thể (VD: 25/03/2024) => chuyển về định dạng YYYY-MM-DD
               - Nếu không có thông tin ngày => trả về null

            Danh sách category hiện có:
            ${categoryNames.join(', ')}

            Trả về kết quả theo định dạng JSON:
            {
              "amount": số tiền đã quy đổi sang VND (number, không có dấu phẩy/chấm phân cách),
              "date": "YYYY-MM-DD" hoặc null nếu không tìm thấy ngày trong hóa đơn,
              "category": "PHẢI là một trong các category trong danh sách trên và phù hợp với ngữ cảnh của hóa đơn",
              "notes": "ghi chú ngắn gọn mô tả nội dung hóa đơn (string) (3-5 từ bằng tiếng anh) "
            }`
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const analysisResult = JSON.parse(completion.choices[0].message.content);

    // Xử lý ngày: nếu không có ngày trong hóa đơn, sử dụng ngày hiện tại
    if (!analysisResult.date) {
      analysisResult.date = getCurrentDate();
    }

    // Chuyển đổi định dạng ngày sang DD MMM YYYY
    const formattedDate = formatDate(analysisResult.date);

    // Kiểm tra category tồn tại
    const categoryInfo = await Category.findOne({ 
      $or: [
        { name: analysisResult.category, userId },
        { name: analysisResult.category, isDefault: true }
      ]
    });

    if (!categoryInfo) {
      // Lấy danh sách category hiện có cho loại giao dịch này
      const existingCategories = await Category.find({
        $or: [
          { userId },
          { isDefault: true }
        ]
      });

      // Lọc category phù hợp với loại giao dịch (expense)
      const suggestedCategories = existingCategories
        .filter(cat => {
          // Các category thường dùng cho expense
          const expenseKeywords = ['food', 'ăn', 'transport', 'đi lại', 'shopping', 'mua sắm', 'bill', 'hóa đơn'];
          const name = cat.name.toLowerCase();
          return expenseKeywords.some(keyword => name.includes(keyword.toLowerCase()));
        })
        .map(cat => ({
          name: cat.name,
          icons: cat.icons.map(icon => icon.iconPath)
        }));

      return res.status(200).json({
        success: true,
        data: {
          needNewCategory: true,
          message: `Danh mục "${analysisResult.category}" chưa tồn tại. Bạn có muốn tạo danh mục mới không?\n\nCác danh mục gợi ý cho giao dịch chi tiêu:\n${suggestedCategories.map(cat => cat.name).join('\n')}\n\nHoặc bạn có thể tạo danh mục mới với tên "${analysisResult.category}"`,
          suggestedCategories,
          transactionData: {
            amount: analysisResult.amount,
            notes: analysisResult.notes,
            type: 'expense',
            category: analysisResult.category,
            date: formattedDate
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
          content: analysisResult.notes
        }
      ],
      max_tokens: 10,
      temperature: 0.3
    });

    const selectedIcon = iconCompletion.choices[0].message.content.trim();
    
    // Kiểm tra xem icon được chọn có trong danh sách không
    const icon = availableIcons.includes(selectedIcon) ? selectedIcon : availableIcons[0];

    res.status(200).json({
      success: true,
      data: {
        ...analysisResult,
        date: formattedDate,
        icon,
        type: 'expense'
      }
    });

  } catch (error) {
    console.error('Bill analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Error analyzing bill',
      error: error.message
    });
  }
};