const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyAdmin } = require('../middleware/auth');

// All admin routes require admin authentication
router.get('/dashboard', verifyAdmin, adminController.getDashboardStats);

// Product management
router.get('/products', verifyAdmin, adminController.getAllProducts);

// Order management
router.get('/orders', verifyAdmin, adminController.getAllOrders);
router.put('/orders/:id/status', verifyAdmin, adminController.updateOrderStatus);
router.put('/orders/:id/cancel', verifyAdmin, adminController.cancelOrderAdmin);

// User management
router.get('/users', verifyAdmin, adminController.getAllUsers);
router.put('/users/:id/rank', verifyAdmin, adminController.updateUserRank);

// Review moderation
const reviewController = require('../controllers/reviewController');
router.get('/reviews', verifyAdmin, reviewController.getAllReviews);
router.delete('/reviews/:id', verifyAdmin, reviewController.deleteReview);

// Voucher management
router.get('/vouchers', verifyAdmin, adminController.getAllVouchers);
router.post('/vouchers', verifyAdmin, adminController.createVoucher);
router.put('/vouchers/:id', verifyAdmin, adminController.updateVoucher);
router.delete('/vouchers/:id', verifyAdmin, adminController.deleteVoucher);

module.exports = router;
