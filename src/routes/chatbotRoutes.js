const express = require('express');
const router = express.Router();
const chatbotController = require('../controllers/chatbotController');

// Chatbot endpoint (supports both authenticated and guest users)
router.post('/', chatbotController.handleChat);

module.exports = router;
