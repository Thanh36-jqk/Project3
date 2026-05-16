const mongoose = require('mongoose');
const prisma = require('../config/postgres');
const Product = require('../models/Product');
const vnpayService = require('../services/vnpayService');
const { finalizeSuccessfulOrder } = require('./orderController');

/**
 * Handle VNPay Return URL (Browser Redirect)
 * GET /api/payments/vnpay_return
 *
 * Acts as a best-effort fallback in case IPN is delayed or missed.
 * IPN is the authoritative handler — the atomic updateMany guard prevents double-finalization.
 */
exports.vnpayReturn = async (req, res) => {
    const vnp_Params = req.query;
    const isValid = vnpayService.verifySignature({ ...vnp_Params });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    if (!isValid) {
        return res.redirect(`${frontendUrl}/pages/vnpay-return.html?status=invalid`);
    }

    const responseCode = vnp_Params['vnp_ResponseCode'];
    const orderId = vnp_Params['vnp_TxnRef'];

    if (responseCode === '00') {
        try {
            // Atomic update: only proceeds if IPN hasn't confirmed yet (prevents double-finalization)
            const updated = await prisma.order.updateMany({
                where: { id: orderId, paymentStatus: { not: 'Paid' } },
                data: { paymentStatus: 'Paid', status: 'Confirmed' }
            });
            if (updated.count > 0) {
                const order = await prisma.order.findUnique({ where: { id: orderId } });
                if (order) await finalizeSuccessfulOrder(order);
            }
        } catch (e) {
            // IPN is authoritative; this fallback is best-effort
            console.error('vnpayReturn fallback error:', e.message);
        }
        return res.redirect(`${frontendUrl}/pages/vnpay-return.html?status=success&orderId=${orderId}`);
    }

    res.redirect(`${frontendUrl}/pages/vnpay-return.html?status=failed&orderId=${orderId}`);
};

/**
 * Handle VNPay IPN (Server-to-Server Webhook) — authoritative payment confirmation
 * GET /api/payments/vnpay_ipn
 */
exports.vnpayIpn = async (req, res) => {
    const vnp_Params = req.query;
    const isValid = vnpayService.verifySignature({ ...vnp_Params });

    if (!isValid) {
        return res.status(200).json({ RspCode: '97', Message: 'Invalid signature' });
    }

    const orderId = vnp_Params['vnp_TxnRef'];
    const responseCode = vnp_Params['vnp_ResponseCode'];
    const transactionNo = vnp_Params['vnp_TransactionNo'];
    const vnpAmount = parseInt(vnp_Params['vnp_Amount'], 10);

    try {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true }
        });

        if (!order) {
            return res.status(200).json({ RspCode: '01', Message: 'Order not found' });
        }

        if (order.paymentStatus === 'Paid') {
            return res.status(200).json({ RspCode: '02', Message: 'Order already confirmed' });
        }

        // Verify amount matches what was originally created (prevents tampering)
        if (vnpAmount !== order.finalAmount * 100) {
            return res.status(200).json({ RspCode: '04', Message: 'Invalid amount' });
        }

        if (responseCode === '00') {
            // Atomic update: prevents race condition with vnpayReturn fallback
            const updated = await prisma.order.updateMany({
                where: { id: orderId, paymentStatus: { not: 'Paid' } },
                data: {
                    paymentStatus: 'Paid',
                    transactionId: transactionNo,
                    status: 'Confirmed'
                }
            });
            if (updated.count > 0) {
                await finalizeSuccessfulOrder(order);
            }
            return res.status(200).json({ RspCode: '00', Message: 'Confirm Success' });
        }

        // Payment failed or cancelled — restore stock and voucher
        await prisma.order.update({
            where: { id: orderId },
            data: { paymentStatus: 'Failed', status: 'Failed' }
        });

        // Restore MongoDB stock for real products
        for (const item of order.items) {
            if (mongoose.Types.ObjectId.isValid(item.productId)) {
                await Product.updateOne(
                    { _id: item.productId },
                    { $inc: { stock: item.qty } }
                );
            }
        }

        // Restore voucher so user can apply it on a new order
        if (order.appliedVoucher && order.userId) {
            await prisma.voucher.updateMany({
                where: { userId: order.userId, code: order.appliedVoucher },
                data: { isUsed: false }
            });
        }

        return res.status(200).json({ RspCode: '00', Message: 'Payment failure recorded' });

    } catch (error) {
        console.error('IPN Error:', error);
        return res.status(200).json({ RspCode: '99', Message: 'Unknown error' });
    }
};
