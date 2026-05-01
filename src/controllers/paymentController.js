const prisma = require('../config/postgres');
const vnpayService = require('../services/vnpayService');

/**
 * Handle VNPay Return URL (Browser Redirect)
 * GET /api/payments/vnpay_return
 */
exports.vnpayReturn = async (req, res) => {
    let vnp_Params = req.query;
    const isValid = vnpayService.verifySignature(vnp_Params);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    if (isValid) {
        const responseCode = vnp_Params['vnp_ResponseCode'];
        const orderId = vnp_Params['vnp_TxnRef'];
        
        if (responseCode === '00') {
            // Payment success
            res.redirect(`${frontendUrl}/pages/vnpay-return.html?status=success&orderId=${orderId}`);
        } else {
            // Payment failed or canceled
            res.redirect(`${frontendUrl}/pages/vnpay-return.html?status=failed&orderId=${orderId}`);
        }
    } else {
        // Invalid checksum
        res.redirect(`${frontendUrl}/pages/vnpay-return.html?status=invalid`);
    }
};

/**
 * Handle VNPay IPN (Server-to-Server Webhook)
 * GET /api/payments/vnpay_ipn
 */
exports.vnpayIpn = async (req, res) => {
    let vnp_Params = req.query;
    const isValid = vnpayService.verifySignature(vnp_Params);

    if (isValid) {
        const orderId = vnp_Params['vnp_TxnRef'];
        const responseCode = vnp_Params['vnp_ResponseCode'];
        const transactionNo = vnp_Params['vnp_TransactionNo'];

        try {
            const order = await prisma.order.findUnique({ where: { id: orderId } });
            
            if (!order) {
                return res.status(200).json({ RspCode: '01', Message: 'Order not found' });
            }

            // Check if order already updated
            if (order.paymentStatus === 'Paid') {
                return res.status(200).json({ RspCode: '02', Message: 'Order already confirmed' });
            }

            if (responseCode === '00') {
                // Payment Success
                await prisma.order.update({
                    where: { id: orderId },
                    data: {
                        paymentStatus: 'Paid',
                        transactionId: transactionNo,
                        status: 'Confirmed'
                    }
                });
                return res.status(200).json({ RspCode: '00', Message: 'Confirm Success' });
            } else {
                // Payment Failed
                await prisma.order.update({
                    where: { id: orderId },
                    data: {
                        paymentStatus: 'Failed'
                    }
                });
                return res.status(200).json({ RspCode: '00', Message: 'Confirm Success (Failed recorded)' });
            }
        } catch (error) {
            console.error('IPN Error:', error);
            return res.status(200).json({ RspCode: '99', Message: 'Unknown error' });
        }
    } else {
        return res.status(200).json({ RspCode: '97', Message: 'Invalid signature' });
    }
};
