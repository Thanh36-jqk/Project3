const request = require('supertest');
const express = require('express');

const controllerImpl = {
    getCart: (req, res) => res.status(200).json({ userId: req.user.id, items: [] }),
    addToCart: (req, res) => res.status(200).json({ message: 'Product added to cart', cart: { items: [{ productId: req.body.productId, quantity: req.body.quantity }] } }),
    mergeCart: (req, res) => res.status(200).json({ message: 'Cart merged' }),
    removeFromCart: (req, res) => res.status(200).json({ message: 'Product removed from cart' }),
    clearCart: (req, res) => res.status(200).json({ message: 'Cart cleared successfully' }),
};
const middlewareImpl = {
    verifyToken: (req, res, next) => { req.user = { id: 'test-user-id', role: 'user' }; next(); },
    verifyAdmin: (req, res, next) => { req.user = { role: 'admin' }; next(); },
};

jest.mock('../../../src/controllers/cartController', () => ({
    getCart: (...a) => controllerImpl.getCart(...a),
    addToCart: (...a) => controllerImpl.addToCart(...a),
    mergeCart: (...a) => controllerImpl.mergeCart(...a),
    removeFromCart: (...a) => controllerImpl.removeFromCart(...a),
    clearCart: (...a) => controllerImpl.clearCart(...a),
}));
jest.mock('../../../src/middleware/auth', () => ({
    verifyToken: (...a) => middlewareImpl.verifyToken(...a),
    verifyAdmin: (...a) => middlewareImpl.verifyAdmin(...a),
}));

const cartRoutes = require('../../../src/routes/cartRoutes');

describe('Cart Routes Integration Tests', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api/cart', cartRoutes);
    });

    beforeEach(() => {
        middlewareImpl.verifyToken = (req, res, next) => {
            req.user = { id: 'test-user-id', role: 'user' }; next();
        };
        controllerImpl.getCart = (req, res) => res.status(200).json({
            userId: 'test-user-id',
            items: [{ productId: '123', name: 'iPhone 15', quantity: 1, price: 20000000 }]
        });
    });

    describe('GET /api/cart', () => {
        test('should require authentication', async () => {
            middlewareImpl.verifyToken = (req, res) =>
                res.status(401).json({ message: 'Unauthorized' });

            const response = await request(app).get('/api/cart');
            expect(response.status).toBe(401);
        });

        test('should return user cart', async () => {
            const response = await request(app)
                .get('/api/cart')
                .set('token', 'Bearer test-token');

            expect(response.status).toBe(200);
            expect(response.body.items).toBeDefined();
        });
    });

    describe('POST /api/cart/add', () => {
        test('should add item to cart', async () => {
            const response = await request(app)
                .post('/api/cart/add')
                .set('token', 'Bearer test-token')
                .send({ productId: '123', quantity: 1 });

            expect(response.status).toBe(200);
        });
    });

    describe('DELETE /api/cart/item/:productId', () => {
        test('should remove item from cart', async () => {
            const response = await request(app)
                .delete('/api/cart/item/123')
                .set('token', 'Bearer test-token');

            expect(response.status).toBe(200);
        });
    });

    describe('DELETE /api/cart/clear', () => {
        test('should clear entire cart', async () => {
            const response = await request(app)
                .delete('/api/cart/clear')
                .set('token', 'Bearer test-token');

            expect(response.status).toBe(200);
        });
    });
});
