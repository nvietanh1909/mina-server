const express = require('express');
const router = express.Router();
const chatbotController = require('../controllers/chatbotController');

// Routes for chatbot
router.post('/chat', chatbotController.generateResponse);
router.get('/history/:userId', chatbotController.getChatHistory);

module.exports = router;