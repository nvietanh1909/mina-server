const express = require('express');
const router = express.Router();
const chatbotController = require('../controllers/chatbotController');

// Tạm thời bỏ middleware protect để test API
router.post('/chat', chatbotController.generateResponse);
router.get('/history/:userId', chatbotController.getChatHistory);

module.exports = router;