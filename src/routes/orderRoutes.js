const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { verifyToken } = require('../middleware/auth');

// Create order (supports both authenticated and guest users)
router.post('/', orderController.createOrder);

// Get order by ID (public for order tracking)
router.get('/:id', orderController.getOrderById);

// Get user's orders (requires authentication)
router.get('/user/all', verifyToken, orderController.getUserOrders);

module.exports = router;
