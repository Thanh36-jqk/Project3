const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { verifyToken } = require('../middleware/auth');
const { validateOrder } = require('../middleware/validate');

// Create order (supports both authenticated and guest users) — with input validation
router.post('/', validateOrder, orderController.createOrder);

// Get order by ID (public for order tracking)
router.get('/:id', orderController.getOrderById);

// Get user's orders (requires authentication)
router.get('/user/all', verifyToken, orderController.getUserOrders);

// Cancel order (authenticated users only)
router.put('/:id/cancel', verifyToken, orderController.cancelOrder);

module.exports = router;
