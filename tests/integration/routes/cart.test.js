const request = require('supertest');
const express = require('express');
const cartRoutes = require('../../src/routes/cartRoutes');

// Mock dependencies
jest.mock('../../src/controllers/cartController');
jest.mock('../../src/middleware/auth');

const cartController = require('../../src/controllers/cartController');
const { verifyToken } = require('../../src/middleware/auth');

describe('Cart Routes Integration Tests', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api/cart', cartRoutes);

        // Mock verifyToken to always authenticate
        verifyToken.mockImplementation((req, res, next) => {
            req.userId = 'test-user-id';
            next();
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/cart', () => {
        test('should require authentication', async () => {
            verifyToken.mockImplementationOnce((req, res, next) => {
                res.status(401).json({ message: 'Unauthorized' });
            });

            const response = await request(app).get('/api/cart');
            expect(response.status).toBe(401);
        });

        test('should return user cart', async () => {
            cartController.getCart = jest.fn((req, res) => {
                res.status(200).json({
                    userId: 'test-user-id',
                    items: [
                        { productId: '123', name: 'iPhone 15', quantity: 1, price: 20000000 }
                    ]
                });
            });

            const response = await request(app)
                .get('/api/cart')
                .set('token', 'Bearer test-token');

            expect(cartController.getCart).toHaveBeenCalled();
            expect(response.status).toBe(200);
            expect(response.body.items).toBeDefined();
        });
    });

    describe('POST /api/cart/add', () => {
        test('should add item to cart', async () => {
            cartController.addToCart = jest.fn((req, res) => {
                res.status(200).json({
                    message: 'Product added to cart',
                    cart: {
                        items: [
                            { productId: '123', quantity: 1 }
                        ]
                    }
                });
            });

            const response = await request(app)
                .post('/api/cart/add')
                .set('token', 'Bearer test-token')
                .send({ productId: '123', quantity: 1 });

            expect(cartController.addToCart).toHaveBeenCalled();
            expect(response.status).toBe(200);
        });
    });

    describe('DELETE /api/cart/item/:productId', () => {
        test('should remove item from cart', async () => {
            cartController.removeFromCart = jest.fn((req, res) => {
                res.status(200).json({
                    message: 'Product removed from cart'
                });
            });

            const response = await request(app)
                .delete('/api/cart/item/123')
                .set('token', 'Bearer test-token');

            expect(cartController.removeFromCart).toHaveBeenCalled();
            expect(response.status).toBe(200);
        });
    });

    describe('DELETE /api/cart/clear', () => {
        test('should clear entire cart', async () => {
            cartController.clearCart = jest.fn((req, res) => {
                res.status(200).json({
                    message: 'Cart cleared successfully'
                });
            });

            const response = await request(app)
                .delete('/api/cart/clear')
                .set('token', 'Bearer test-token');

            expect(cartController.clearCart).toHaveBeenCalled();
            expect(response.status).toBe(200);
        });
    });
});
