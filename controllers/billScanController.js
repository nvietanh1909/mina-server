const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

exports.analyzeBill = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'OCR text is required'
      });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `Bạn là một hệ thống phân tích hóa đơn thông minh, có khả năng đọc hiểu hóa đơn, đa ngôn ngữ và chuyển đổi tiền tệ.

            Nhiệm vụ của bạn là:
            1. Phân tích và làm sạch text đầu vào và nhận biết tổng tiền nằm ở đâu do detect có thể bị lỗi vài chỗ
            2. Nhận diện loại tiền tệ và quy đổi sang VND theo tỷ giá cập nhật tại thời điểm hiện tại:
            3. Phân loại hóa đơn vào các danh mục dựa vào text nhé
            4. Tạo ghi chú ngắn gọn mô tả nội dung chính của hóa đơn

            Trả về kết quả theo định dạng JSON:
            {
              "amount": số tiền đã quy đổi sang VND (number, không có dấu phẩy/chấm phân cách)(dùng toàn bộ là tiền việt nam),
              "category": "danh mục hóa don (string)" dùng tiếng anh,
              "notes": "ghi chú ngắn gọn mô tả nội dung hóa đơn (string)"
            }`
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 1,
      max_tokens: 500
    });

    const analysisResult = JSON.parse(completion.choices[0].message.content);

    res.status(200).json({
      success: true,
      data: analysisResult
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