const express = require('express');
const router = express.Router();
const chatbotController = require('../controllers/chatbotController');
const { chatLimiter, chatDailyLimiter } = require('../middleware/rateLimiter');

// chatDailyLimiter: 30 req/day per IP (protect shared Gemini quota)
// chatLimiter: 5 req/min per IP (prevent burst flooding)
router.post('/message', chatDailyLimiter, chatLimiter, chatbotController.handleChat);

module.exports = router;
