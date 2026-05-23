const request = require('supertest');
const express = require('express');

const controllerImpl = {
    getWishlist: (req, res) => res.status(200).json({ wishlist: [] }),
    addToWishlist: (req, res) => res.status(200).json({ message: 'Added to wishlist', wishlist: [] }),
    removeFromWishlist: (req, res) => res.status(200).json({ message: 'Removed from wishlist', wishlist: [] }),
};
const middlewareImpl = {
    verifyToken: (req, res, next) => { req.user = { id: 'user-1', role: 'user' }; next(); },
};

jest.mock('../../../src/controllers/wishlistController', () => ({
    getWishlist: (...a) => controllerImpl.getWishlist(...a),
    addToWishlist: (...a) => controllerImpl.addToWishlist(...a),
    removeFromWishlist: (...a) => controllerImpl.removeFromWishlist(...a),
}));
jest.mock('../../../src/middleware/auth', () => ({
    verifyToken: (...a) => middlewareImpl.verifyToken(...a),
    verifyAdmin: (req, res, next) => next(),
}));

const wishlistRoutes = require('../../../src/routes/wishlistRoutes');

describe('Wishlist Routes Integration Tests', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/', wishlistRoutes);
    });

    beforeEach(() => {
        controllerImpl.getWishlist = (req, res) => res.status(200).json({ wishlist: [] });
        controllerImpl.addToWishlist = (req, res) =>
            res.status(200).json({ message: 'Added to wishlist', wishlist: [] });
        controllerImpl.removeFromWishlist = (req, res) =>
            res.status(200).json({ message: 'Removed from wishlist', wishlist: [] });
        middlewareImpl.verifyToken = (req, res, next) => { req.user = { id: 'user-1' }; next(); };
    });

    describe('GET / — getWishlist', () => {
        test('should return wishlist when authenticated', async () => {
            const res = await request(app).get('/');
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('wishlist');
        });

        test('should return 401 when not authenticated', async () => {
            middlewareImpl.verifyToken = (req, res) => res.status(401).json({ message: 'Unauthorized' });
            const res = await request(app).get('/');
            expect(res.status).toBe(401);
        });
    });

    describe('POST /add — addToWishlist', () => {
        test('should add product to wishlist', async () => {
            const res = await request(app)
                .post('/add')
                .send({ productId: 'prod-1' });
            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Added to wishlist');
        });

        test('should return 400 if productId is missing', async () => {
            controllerImpl.addToWishlist = (req, res) =>
                res.status(400).json({ message: 'Product ID is required' });
            const res = await request(app).post('/add').send({});
            expect(res.status).toBe(400);
        });

        test('should return 400 if product already in wishlist', async () => {
            controllerImpl.addToWishlist = (req, res) =>
                res.status(400).json({ message: 'Product already in wishlist' });
            const res = await request(app).post('/add').send({ productId: 'prod-1' });
            expect(res.status).toBe(400);
            expect(res.body.message).toBe('Product already in wishlist');
        });

        test('should return 401 when not authenticated', async () => {
            middlewareImpl.verifyToken = (req, res) => res.status(401).json({ message: 'Unauthorized' });
            const res = await request(app).post('/add').send({ productId: 'prod-1' });
            expect(res.status).toBe(401);
        });
    });

    describe('DELETE /remove/:productId — removeFromWishlist', () => {
        test('should remove product from wishlist', async () => {
            const res = await request(app).delete('/remove/prod-1');
            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Removed from wishlist');
        });

        test('should return 404 if user not found', async () => {
            controllerImpl.removeFromWishlist = (req, res) =>
                res.status(404).json({ message: 'User not found' });
            const res = await request(app).delete('/remove/prod-99');
            expect(res.status).toBe(404);
        });
    });
});
