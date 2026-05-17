const request = require('supertest');
const express = require('express');

const controllerImpl = {
    createOrder: (req, res) => res.status(201).json({
        message: 'Order placed successfully',
        order: { _id: 'order123', total: 20000000, status: 'Pending' }
    }),
    getOrderById: (req, res) => res.status(200).json({
        _id: req.params.id, status: 'Pending', total: 20000000
    }),
    getUserOrders: (req, res) => res.status(200).json([
        { _id: 'order1', total: 20000000 },
        { _id: 'order2', total: 45000000 }
    ]),
};
const middlewareImpl = {
    verifyToken: (req, res, next) => { req.user = { id: 'user123', role: 'user' }; next(); },
    verifyAdmin: (req, res, next) => { req.user = { role: 'admin' }; next(); },
};

jest.mock('../../../src/controllers/orderController', () => ({
    createOrder: (...a) => controllerImpl.createOrder(...a),
    getOrderById: (...a) => controllerImpl.getOrderById(...a),
    getUserOrders: (...a) => controllerImpl.getUserOrders(...a),
    finalizeSuccessfulOrder: jest.fn(),
}));
jest.mock('../../../src/middleware/auth', () => ({
    verifyToken: (...a) => middlewareImpl.verifyToken(...a),
    verifyAdmin: (...a) => middlewareImpl.verifyAdmin(...a),
}));
jest.mock('../../../src/middleware/validate', () => {
    const pass = (req, res, next) => next();
    return {
        validateRegister: [pass], validateLogin: [pass],
        validateForgotPassword: [pass], validateResetPassword: [pass],
        validateOrder: [pass], handleValidationErrors: pass,
    };
});

const orderRoutes = require('../../../src/routes/orderRoutes');

describe('Order Routes Integration Tests', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api/orders', orderRoutes);
    });

    beforeEach(() => {
        middlewareImpl.verifyToken = (req, res, next) => {
            req.user = { id: 'user123', role: 'user' }; next();
        };
        controllerImpl.createOrder = (req, res) => res.status(201).json({
            message: 'Order placed successfully',
            order: { _id: 'order123', total: 20000000, status: 'Pending' }
        });
    });

    describe('POST /api/orders', () => {
        test('should create order for guest user', async () => {
            const response = await request(app)
                .post('/api/orders')
                .send({
                    items: [{ productId: '123', quantity: 1, price: 20000000 }],
                    recipientName: 'Test User',
                    recipientPhone: '0123456789',
                    shippingAddress: 'Test Address'
                });

            expect(response.status).toBe(201);
        });

        test('should create order for authenticated user', async () => {
            const response = await request(app)
                .post('/api/orders')
                .set('token', 'Bearer test-token')
                .send({
                    items: [{ productId: '123', quantity: 1 }],
                    recipientName: 'Test User',
                    recipientPhone: '0123456789',
                    shippingAddress: 'Test Address'
                });

            expect(response.status).toBe(201);
        });
    });

    describe('GET /api/orders/:id', () => {
        test('should get order by ID', async () => {
            const response = await request(app).get('/api/orders/order123');

            expect(response.status).toBe(200);
            expect(response.body._id).toBe('order123');
        });

        test('should return 404 for non-existent order', async () => {
            controllerImpl.getOrderById = (req, res) =>
                res.status(404).json({ message: 'Order not found' });

            const response = await request(app).get('/api/orders/nonexistent');
            expect(response.status).toBe(404);
        });
    });

    describe('GET /api/orders/user/all', () => {
        test('should require authentication', async () => {
            middlewareImpl.verifyToken = (req, res) =>
                res.status(401).json({ message: 'Unauthorized' });

            const response = await request(app).get('/api/orders/user/all');
            expect(response.status).toBe(401);
        });

        test('should return user orders when authenticated', async () => {
            const response = await request(app)
                .get('/api/orders/user/all')
                .set('token', 'Bearer test-token');

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });
    });
});
