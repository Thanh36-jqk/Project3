const express = require('express');
const router = express.Router();

// Import all route modules
const authRoutes = require('./authRoutes');
const productRoutes = require('./productRoutes');
const cartRoutes = require('./cartRoutes');
const orderRoutes = require('./orderRoutes');
const voucherRoutes = require('./voucherRoutes');
const wishlistRoutes = require('./wishlistRoutes');
const chatbotRoutes = require('./chatbotRoutes');
const adminRoutes = require('./adminRoutes');
const paymentRoutes = require('./paymentRoutes');
const addressRoutes = require('./addressRoutes');
const reviewRoutes = require('./reviewRoutes');
const { orderReturnRouter, adminReturnRouter } = require('./returnRoutes');

// Mount routes
router.use('/', authRoutes);  // Mounts both /api/register, /api/login, AND /auth/google
router.use('/api/products', productRoutes);
router.use('/api/products/:id/reviews', reviewRoutes);
router.use('/api/cart', cartRoutes);
router.use('/api/orders', orderRoutes);
router.use('/api/vouchers', voucherRoutes);
router.use('/api/wishlist', wishlistRoutes);
router.use('/api/chat', chatbotRoutes);
router.use('/api/admin', adminRoutes);
router.use('/api/payments', paymentRoutes);
router.use('/api/users/addresses', addressRoutes);
router.use('/api/orders/:id/return', orderReturnRouter);
router.use('/api/admin/returns', adminReturnRouter);

module.exports = router;
