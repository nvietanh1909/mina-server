const Chatbot = require('../models/chatbotModel');
const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

exports.generateResponse = async (req, res) => {
  try {
    const { message, userId } = req.body;

    if (!message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Message is required' 
      });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "Bạn là một trợ lý tài chính thông minh, giúp người dùng quản lý chi tiêu hiệu quả."
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

    // Lưu cuộc hội thoại vào database
    const chatbot = new Chatbot({
      userId,
      message,
      response: botResponse
    });

    await chatbot.save();

    res.status(200).json({
      success: true,
      data: {
        message,
        response: botResponse
      }
    });

  } catch (error) {
    console.error('Chatbot error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
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
