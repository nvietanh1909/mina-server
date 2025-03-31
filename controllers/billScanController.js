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
          content: `You are an intelligent bill analysis system that can understand receipts in multiple languages and convert all currencies to VND.

Your tasks:
1. Analyze and clean input text to find amounts:
   - "X ngan", "X ngàn" => X * 1000 VND
   - "X trieu", "X triệu" => X * 1000000 VND
   - "X k" => X * 1000 VND
   - "X đ", "X d", "X vnd", "X VND" => X VND
   - Foreign currency => Convert to VND at current rate

2. Create a suitable 1-2 word category name in English based on the context (max 2 words)
3. Select an appropriate emoji icon for the category (single emoji)
4. Create a short note describing the bill content
5. Handle dates:
   - "hom nay" or "ngày này" => ${today}
   - "ngay mai" or "mai" => ${tomorrow}
   - "hom qua" => ${yesterday}
   - Specific dates (e.g. 25/03/2024) => YYYY-MM-DD format
   - No date info => null

6. Determine transaction type:
   - If text contains keywords like "salary", "lương", "thu nhập", "bonus", "thưởng", "investment", "đầu tư" => type: "income"
   - Otherwise => type: "expense"

Return JSON format:
{
  "amount": number in VND (no separators),
  "date": "YYYY-MM-DD" or null,
  "category": "1-2 word English category name",
  "notes": "3-5 word English description",
  "icon": "single emoji representing the category",
  "type": "expense" or "income"
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

    res.status(200).json({
      success: true,
      data: {
        ...analysisResult,
        date: formattedDate
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