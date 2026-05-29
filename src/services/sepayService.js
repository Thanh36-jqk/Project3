/**
 * SePay Payment Service
 * Docs: https://docs.sepay.vn
 */

/**
 * Tạo thông tin thanh toán SePay (QR + mã tham chiếu)
 * @param {string} orderId - UUID của order
 * @param {number} amount - Số tiền VND
 * @returns {{ code, qrUrl, amount, accountNumber, bankCode }}
 */
exports.generatePaymentInfo = (orderId, amount) => {
    const code = 'APPLE' + orderId.replace(/-/g, '').slice(0, 8).toUpperCase();
    const acc = process.env.SEPAY_ACCOUNT_NUMBER;
    const bank = process.env.SEPAY_BANK_CODE;
    const qrUrl = `https://qr.sepay.vn/img?acc=${acc}&bank=${bank}&amount=${amount}&des=${code}&template=compact`;
    return { code, qrUrl, amount, accountNumber: acc, bankCode: bank };
};

/**
 * Xác thực webhook từ SePay qua API key trong Authorization header
 * @param {import('express').Request} req
 * @returns {boolean}
 */
exports.verifyWebhook = (req) => {
    const authHeader = req.headers['authorization'] || '';
    return authHeader === `Apikey ${process.env.SEPAY_API_KEY}`;
};
