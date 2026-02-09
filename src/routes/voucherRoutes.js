const express = require('express');
const router = express.Router();
const voucherController = require('../controllers/voucherController');
const { verifyToken } = require('../middleware/auth');

// All voucher routes require authentication
router.get('/available', verifyToken, voucherController.getAvailableVouchers);
router.post('/redeem', verifyToken, voucherController.redeemVoucher);

module.exports = router;
