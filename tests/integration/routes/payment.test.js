const request = require('supertest');
const express = require('express');

const controllerImpl = {
    vnpayReturn: (req, res) => res.redirect('/?payment=success'),
    vnpayIpn: (req, res) => res.status(200).json({ RspCode: '00', Message: 'Confirm Success' }),
};

jest.mock('../../../src/controllers/paymentController', () => ({
    vnpayReturn: (...a) => controllerImpl.vnpayReturn(...a),
    vnpayIpn: (...a) => controllerImpl.vnpayIpn(...a),
}));

const paymentRoutes = require('../../../src/routes/paymentRoutes');

describe('Payment Routes Integration Tests', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/', paymentRoutes);
    });

    beforeEach(() => {
        controllerImpl.vnpayReturn = (req, res) => res.redirect('/?payment=success');
        controllerImpl.vnpayIpn = (req, res) =>
            res.status(200).json({ RspCode: '00', Message: 'Confirm Success' });
    });

    describe('GET /vnpay_return — browser redirect callback', () => {
        test('should redirect on successful payment', async () => {
            const res = await request(app)
                .get('/vnpay_return')
                .query({ vnp_ResponseCode: '00', vnp_TxnRef: 'order-123' });
            expect([302, 200]).toContain(res.status);
        });

        test('should redirect on failed/cancelled payment', async () => {
            controllerImpl.vnpayReturn = (req, res) => res.redirect('/?payment=failed');
            const res = await request(app)
                .get('/vnpay_return')
                .query({ vnp_ResponseCode: '24', vnp_TxnRef: 'order-123' });
            expect([302, 200]).toContain(res.status);
        });

        test('should redirect to invalid page on bad signature', async () => {
            controllerImpl.vnpayReturn = (req, res) => res.redirect('/?payment=invalid');
            const res = await request(app)
                .get('/vnpay_return')
                .query({ vnp_ResponseCode: '97' });
            expect([302, 200]).toContain(res.status);
        });
    });

    describe('GET /vnpay_ipn — server-to-server webhook', () => {
        test('should return RspCode 00 on valid IPN', async () => {
            const res = await request(app)
                .get('/vnpay_ipn')
                .query({ vnp_ResponseCode: '00', vnp_TxnRef: 'order-123' });
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('RspCode', '00');
        });

        test('should return RspCode 97 on invalid signature', async () => {
            controllerImpl.vnpayIpn = (req, res) =>
                res.status(200).json({ RspCode: '97', Message: 'Checksum failed' });
            const res = await request(app)
                .get('/vnpay_ipn')
                .query({ vnp_SecureHash: 'invalid-hash' });
            expect(res.status).toBe(200);
            expect(res.body.RspCode).toBe('97');
        });

        test('should return RspCode 04 on tampered amount', async () => {
            controllerImpl.vnpayIpn = (req, res) =>
                res.status(200).json({ RspCode: '04', Message: 'Invalid Amount' });
            const res = await request(app)
                .get('/vnpay_ipn')
                .query({ vnp_Amount: '99999999900' });
            expect(res.status).toBe(200);
            expect(res.body.RspCode).toBe('04');
        });
    });
});
