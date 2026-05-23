const request = require('supertest');
const express = require('express');

const controllerImpl = {
    getAvailableVouchers: (req, res) => res.status(200).json([{ code: 'SAVE10', discountAmount: 10000 }]),
    redeemVoucher: (req, res) => res.status(200).json({ message: 'Voucher redeemed successfully', points: 300 }),
};
const middlewareImpl = {
    verifyToken: (req, res, next) => { req.user = { id: 'user-1', role: 'user' }; next(); },
};

jest.mock('../../../src/controllers/voucherController', () => ({
    getAvailableVouchers: (...a) => controllerImpl.getAvailableVouchers(...a),
    redeemVoucher: (...a) => controllerImpl.redeemVoucher(...a),
}));
jest.mock('../../../src/middleware/auth', () => ({
    verifyToken: (...a) => middlewareImpl.verifyToken(...a),
    verifyAdmin: (req, res, next) => next(),
}));

const voucherRoutes = require('../../../src/routes/voucherRoutes');

describe('Voucher Routes Integration Tests', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/', voucherRoutes);
    });

    beforeEach(() => {
        controllerImpl.getAvailableVouchers = (req, res) =>
            res.status(200).json([{ code: 'SAVE10', discountAmount: 10000 }]);
        controllerImpl.redeemVoucher = (req, res) =>
            res.status(200).json({ message: 'Voucher redeemed successfully', points: 300 });
        middlewareImpl.verifyToken = (req, res, next) => { req.user = { id: 'user-1' }; next(); };
    });

    describe('GET /available — getAvailableVouchers', () => {
        test('should return available vouchers when authenticated', async () => {
            const res = await request(app).get('/available');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body[0]).toHaveProperty('code');
        });

        test('should return 401 when not authenticated', async () => {
            middlewareImpl.verifyToken = (req, res) => res.status(401).json({ message: 'Unauthorized' });
            const res = await request(app).get('/available');
            expect(res.status).toBe(401);
        });
    });

    describe('POST /redeem — redeemVoucher', () => {
        test('should redeem a voucher successfully', async () => {
            const res = await request(app)
                .post('/redeem')
                .send({ voucherId: 'v1' });
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('message', 'Voucher redeemed successfully');
            expect(res.body).toHaveProperty('points');
        });

        test('should return 400 if voucher not available', async () => {
            controllerImpl.redeemVoucher = (req, res) =>
                res.status(400).json({ message: 'Voucher not available' });
            const res = await request(app).post('/redeem').send({ voucherId: 'bad-id' });
            expect(res.status).toBe(400);
        });

        test('should return 400 if insufficient points', async () => {
            controllerImpl.redeemVoucher = (req, res) =>
                res.status(400).json({ message: 'Insufficient points' });
            const res = await request(app).post('/redeem').send({ voucherId: 'v1' });
            expect(res.status).toBe(400);
            expect(res.body.message).toBe('Insufficient points');
        });

        test('should return 401 when not authenticated', async () => {
            middlewareImpl.verifyToken = (req, res) => res.status(401).json({ message: 'Unauthorized' });
            const res = await request(app).post('/redeem').send({ voucherId: 'v1' });
            expect(res.status).toBe(401);
        });
    });
});
