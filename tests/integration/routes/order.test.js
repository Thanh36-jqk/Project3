const request = require('supertest');
const express = require('express');
const orderRoutes = require('../../src/routes/orderRoutes');

// Mock dependencies
jest.mock('../../src/controllers/orderController');
jest.mock('../../src/middleware/auth');

const orderController = require('../../src/controllers/orderController');
const { verifyToken } = require('../../src/middleware/auth');

describe('Order Routes Integration Tests', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api/orders', orderRoutes);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/orders', () => {
        test('should create order for guest user', async () => {
            orderController.createOrder = jest.fn((req, res) => {
                res.status(201).json({
                    message: 'Order placed successfully',
                    order: {
                        _id: 'order123',
                        total: 20000000,
                        status: 'Pending'
                    }
                });
            });

            const response = await request(app)
                .post('/api/orders')
                .send({
                    items: [{ productId: '123', quantity: 1, price: 20000000 }],
                    recipientName: 'Test User',
                    recipientPhone: '0123456789',
                    shippingAddress: 'Test Address'
                });

            expect(orderController.createOrder).toHaveBeenCalled();
            expect(response.status).toBe(201);
        });

        test('should create order for authenticated user', async () => {
            orderController.createOrder = jest.fn((req, res) => {
                res.status(201).json({
                    message: 'Order placed successfully',
                    order: { _id: 'order123' }
                });
            });

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
            orderController.getOrderById = jest.fn((req, res) => {
                res.status(200).json({
                    _id: 'order123',
                    status: 'Pending',
                    total: 20000000
                });
            });

            const response = await request(app).get('/api/orders/order123');

            expect(orderController.getOrderById).toHaveBeenCalled();
            expect(response.status).toBe(200);
            expect(response.body._id).toBe('order123');
        });

        test('should return 404 for non-existent order', async () => {
            orderController.getOrderById = jest.fn((req, res) => {
                res.status(404).json({ message: 'Order not found' });
            });

            const response = await request(app).get('/api/orders/nonexistent');

            expect(response.status).toBe(404);
        });
    });

    describe('GET /api/orders/user/all', () => {
        test('should require authentication', async () => {
            verifyToken.mockImplementation((req, res, next) => {
                res.status(401).json({ message: 'Unauthorized' });
            });

            const response = await request(app).get('/api/orders/user/all');

            expect(response.status).toBe(401);
        });

        test('should return user orders when authenticated', async () => {
            verifyToken.mockImplementation((req, res, next) => {
                req.userId = 'user123';
                next();
            });

            orderController.getUserOrders = jest.fn((req, res) => {
                res.status(200).json([
                    { _id: 'order1', total: 20000000 },
                    { _id: 'order2', total: 45000000 }
                ]);
            });

            const response = await request(app)
                .get('/api/orders/user/all')
                .set('token', 'Bearer test-token');

            expect(orderController.getUserOrders).toHaveBeenCalled();
            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });
    });
});
