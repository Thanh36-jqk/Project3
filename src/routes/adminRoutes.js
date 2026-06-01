const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const analyticsController = require('../controllers/adminAnalyticsController');
const { verifyAdmin } = require('../middleware/auth');

// All admin routes require admin authentication
router.get('/dashboard', verifyAdmin, adminController.getDashboardStats);

// Product management
router.get('/products', verifyAdmin, adminController.getAllProducts);

// Order management
router.get('/orders/export', verifyAdmin, adminController.exportOrders);
router.get('/orders', verifyAdmin, adminController.getAllOrders);
router.patch('/orders/bulk-status', verifyAdmin, adminController.bulkUpdateOrderStatus);
router.put('/orders/:id/status', verifyAdmin, adminController.updateOrderStatus);
router.put('/orders/:id/cancel', verifyAdmin, adminController.cancelOrderAdmin);

// User management
router.get('/users/export', verifyAdmin, adminController.exportUsers);
router.get('/users', verifyAdmin, adminController.getAllUsers);
router.put('/users/:id/rank', verifyAdmin, adminController.updateUserRank);
router.post('/users/:id/vouchers', verifyAdmin, adminController.giveVoucherToUser);

// Review moderation
const reviewController = require('../controllers/reviewController');
router.get('/reviews', verifyAdmin, reviewController.getAllReviews);
router.delete('/reviews/:id', verifyAdmin, reviewController.deleteReview);

// Voucher management
router.get('/vouchers', verifyAdmin, adminController.getAllVouchers);
router.post('/vouchers', verifyAdmin, adminController.createVoucher);
router.put('/vouchers/:id', verifyAdmin, adminController.updateVoucher);
router.delete('/vouchers/:id', verifyAdmin, adminController.deleteVoucher);

// Audit log
router.get('/audit-logs', verifyAdmin, adminController.getAuditLogs);

// Analytics routes
router.get('/analytics/revenue', verifyAdmin, analyticsController.getRevenue);
router.get('/analytics/top-products', verifyAdmin, analyticsController.getTopProducts);
router.get('/analytics/order-funnel', verifyAdmin, analyticsController.getOrderFunnel);
router.get('/analytics/user-segments', verifyAdmin, analyticsController.getUserSegments);
router.get('/analytics/payment-methods', verifyAdmin, analyticsController.getPaymentMethods);
router.get('/analytics/category-revenue', verifyAdmin, analyticsController.getCategoryRevenue);

module.exports = router;
