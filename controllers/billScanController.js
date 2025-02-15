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

    // Phân tích text bằng OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `Bạn là một hệ thống phân tích hóa đơn. Phân tích đoạn text sau và trích xuất:
          1. Số tiền tổng cộng
          2. Phân loại vào một trong các danh mục: Food, Transport, Shopping, Entertainment, Health, Education,... tùy vào nội dung hóa đơn
          3. Tạo ghi chú ngắn gọn mô tả nội dung hóa đơn
          bạn hãy phân tích rõ nội dung và trả về kết quả phân tích.
          Trả về CHÍNH XÁC theo định dạng JSON sau:
          {
            "amount": số tiền (number), (không được có bất kì dấu gì, chỉ có số),
            "category": "danh mục (string)",
            "notes": "ghi chú mô tả (string)"
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