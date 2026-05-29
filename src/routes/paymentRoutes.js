const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// VNPay: browser redirect sau thanh toán
router.get('/vnpay_return', paymentController.vnpayReturn);

// VNPay: server-to-server IPN webhook
router.get('/vnpay_ipn', paymentController.vnpayIpn);

// SePay: server-to-server webhook khi phát hiện giao dịch
router.post('/sepay_webhook', paymentController.sepayWebhook);

module.exports = router;
