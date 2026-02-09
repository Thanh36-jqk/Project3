const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { verifyToken } = require('../middleware/auth');

// All cart routes require authentication
router.get('/', verifyToken, cartController.getCart);
router.post('/add', verifyToken, cartController.addToCart);
router.delete('/item/:productId', verifyToken, cartController.removeFromCart);
router.delete('/clear', verifyToken, cartController.clearCart);

module.exports = router;
