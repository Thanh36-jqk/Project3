const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Handles the browser redirect back from VNPay
router.get('/vnpay_return', paymentController.vnpayReturn);

// Handles the server-to-server webhook from VNPay
router.get('/vnpay_ipn', paymentController.vnpayIpn);

module.exports = router;
