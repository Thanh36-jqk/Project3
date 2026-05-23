const request = require('supertest');
const express = require('express');

const controllerImpl = {
    getDashboardStats: (req, res) => res.status(200).json({ totalProducts: 10, totalOrders: 50, totalUsers: 100, totalRevenue: 5000000 }),
    getAllProducts: (req, res) => res.status(200).json([]),
    getAllOrders: (req, res) => res.status(200).json([]),
    updateOrderStatus: (req, res) => res.status(200).json({ id: req.params.id, status: req.body.status }),
    getAllUsers: (req, res) => res.status(200).json([]),
    updateUserRank: (req, res) => res.status(200).json({ id: req.params.id, rank: req.body.rank }),
    getAllVouchers: (req, res) => res.status(200).json([]),
    createVoucher: (req, res) => res.status(201).json({ code: req.body.code }),
    updateVoucher: (req, res) => res.status(200).json({ id: req.params.id }),
    deleteVoucher: (req, res) => res.status(200).json({ message: 'Voucher deleted successfully' }),
    cancelOrderAdmin: (req, res) => res.status(200).json({ message: 'Order cancelled successfully' }),
};
const middlewareImpl = {
    verifyAdmin: (req, res, next) => { req.user = { id: 'admin-1', role: 'admin' }; next(); },
};

jest.mock('../../../src/controllers/adminController', () => ({
    getDashboardStats: (...a) => controllerImpl.getDashboardStats(...a),
    getAllProducts: (...a) => controllerImpl.getAllProducts(...a),
    getAllOrders: (...a) => controllerImpl.getAllOrders(...a),
    updateOrderStatus: (...a) => controllerImpl.updateOrderStatus(...a),
    getAllUsers: (...a) => controllerImpl.getAllUsers(...a),
    updateUserRank: (...a) => controllerImpl.updateUserRank(...a),
    getAllVouchers: (...a) => controllerImpl.getAllVouchers(...a),
    createVoucher: (...a) => controllerImpl.createVoucher(...a),
    updateVoucher: (...a) => controllerImpl.updateVoucher(...a),
    deleteVoucher: (...a) => controllerImpl.deleteVoucher(...a),
    cancelOrderAdmin: (...a) => controllerImpl.cancelOrderAdmin(...a),
}));
jest.mock('../../../src/controllers/reviewController', () => ({
    deleteReview: (req, res) => res.status(200).json({ message: 'Review deleted successfully' }),
    recalculateProductRatings: jest.fn(),
}));
jest.mock('../../../src/middleware/auth', () => ({
    verifyToken: (req, res, next) => next(),
    verifyAdmin: (...a) => middlewareImpl.verifyAdmin(...a),
}));

const adminRoutes = require('../../../src/routes/adminRoutes');

describe('Admin Routes Integration Tests', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/', adminRoutes);
    });

    beforeEach(() => {
        middlewareImpl.verifyAdmin = (req, res, next) => { req.user = { id: 'admin-1', role: 'admin' }; next(); };
    });

    describe('Authentication guard', () => {
        test('should return 403 for non-admin access', async () => {
            middlewareImpl.verifyAdmin = (req, res) => res.status(403).json({ message: 'Forbidden' });
            const res = await request(app).get('/dashboard');
            expect(res.status).toBe(403);
        });
    });

    describe('GET /dashboard', () => {
        test('should return dashboard stats for admin', async () => {
            const res = await request(app).get('/dashboard');
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('totalProducts');
            expect(res.body).toHaveProperty('totalOrders');
            expect(res.body).toHaveProperty('totalUsers');
            expect(res.body).toHaveProperty('totalRevenue');
        });
    });

    describe('GET /products', () => {
        test('should return all products for admin', async () => {
            const res = await request(app).get('/products');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });
    });

    describe('Order management', () => {
        test('GET /orders — should return all orders', async () => {
            const res = await request(app).get('/orders');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });

        test('PUT /orders/:id/status — should update order status', async () => {
            const res = await request(app)
                .put('/orders/order-123/status')
                .send({ status: 'Shipped' });
            expect(res.status).toBe(200);
        });

        test('PUT /orders/:id/status — should return 400 for invalid status', async () => {
            controllerImpl.updateOrderStatus = (req, res) =>
                res.status(400).json({ message: 'Invalid status' });
            const res = await request(app)
                .put('/orders/order-123/status')
                .send({ status: 'Invalid' });
            expect(res.status).toBe(400);
        });
    });

    describe('User management', () => {
        test('GET /users — should return all users', async () => {
            const res = await request(app).get('/users');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });

        test('PUT /users/:id/rank — should update user rank', async () => {
            const res = await request(app)
                .put('/users/user-1/rank')
                .send({ rank: 'Gold' });
            expect(res.status).toBe(200);
        });

        test('PUT /users/:id/rank — should return 400 for invalid rank', async () => {
            controllerImpl.updateUserRank = (req, res) =>
                res.status(400).json({ message: 'Invalid rank' });
            const res = await request(app)
                .put('/users/user-1/rank')
                .send({ rank: 'Diamond' });
            expect(res.status).toBe(400);
        });
    });

    describe('Voucher management', () => {
        test('GET /vouchers — should return all vouchers', async () => {
            const res = await request(app).get('/vouchers');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });

        test('POST /vouchers — should create a new voucher', async () => {
            const res = await request(app)
                .post('/vouchers')
                .send({ code: 'NEW20', discountAmount: 20000, pointsRequired: 100, quantity: 50 });
            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('code');
        });

        test('POST /vouchers — should return 400 for missing fields', async () => {
            controllerImpl.createVoucher = (req, res) =>
                res.status(400).json({ message: 'code, discountAmount, and pointsRequired are required' });
            const res = await request(app).post('/vouchers').send({ code: 'INCOMPLETE' });
            expect(res.status).toBe(400);
        });

        test('PUT /vouchers/:id — should update voucher', async () => {
            const res = await request(app)
                .put('/vouchers/v1')
                .send({ isActive: false });
            expect(res.status).toBe(200);
        });

        test('DELETE /vouchers/:id — should delete voucher', async () => {
            const res = await request(app).delete('/vouchers/v1');
            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Voucher deleted successfully');
        });

        test('DELETE /vouchers/:id — should return 404 if not found', async () => {
            controllerImpl.deleteVoucher = (req, res) =>
                res.status(404).json({ message: 'Voucher not found' });
            const res = await request(app).delete('/vouchers/nonexistent');
            expect(res.status).toBe(404);
        });
    });
});
