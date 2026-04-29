const express = require('express');
const router = express.Router();
const chatbotController = require('../controllers/chatbotController');
const { chatLimiter } = require('../middleware/rateLimiter');

// Chat endpoint with rate limiting (20 requests/min — AI calls are expensive)
router.post('/message', chatLimiter, chatbotController.handleChat);

module.exports = router;
