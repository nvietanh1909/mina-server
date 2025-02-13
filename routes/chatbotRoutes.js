const express = require('express');
const router = express.Router();
const chatbotController = require('../controllers/chatbotController');
const auth = require('../middleware/authMiddleware');

router.use(auth);

// Routes for chatbot
router.post('/chat', chatbotController.generateResponse);
router.get('/history/:userId', chatbotController.getChatHistory);

module.exports = router;