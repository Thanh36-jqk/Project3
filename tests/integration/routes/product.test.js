const request = require('supertest');
const express = require('express');

const controllerImpl = {
    getAllProducts: (req, res) => res.status(200).json([]),
    searchProducts: (req, res) => res.status(200).json([]),
    getProductById: (req, res) => res.status(200).json({ _id: req.params.id }),
    createProduct: (req, res) => res.status(201).json({ _id: 'new', ...req.body }),
    updateProduct: (req, res) => res.status(200).json({ _id: req.params.id, ...req.body }),
    updateStock: (req, res) => res.status(200).json({ _id: req.params.id, stock: req.body.stock }),
    deleteProduct: (req, res) => res.status(200).json({ message: 'Product deleted successfully' }),
};
const middlewareImpl = {
    verifyAdmin: (req, res, next) => { req.user = { role: 'admin' }; next(); },
    verifyToken: (req, res, next) => { req.user = { id: 'user', role: 'user' }; next(); },
};

jest.mock('../../../src/controllers/productController', () => ({
    getAllProducts: (...a) => controllerImpl.getAllProducts(...a),
    searchProducts: (...a) => controllerImpl.searchProducts(...a),
    getProductById: (...a) => controllerImpl.getProductById(...a),
    createProduct: (...a) => controllerImpl.createProduct(...a),
    updateProduct: (...a) => controllerImpl.updateProduct(...a),
    updateStock: (...a) => controllerImpl.updateStock(...a),
    deleteProduct: (...a) => controllerImpl.deleteProduct(...a),
}));
jest.mock('../../../src/middleware/auth', () => ({
    verifyToken: (...a) => middlewareImpl.verifyToken(...a),
    verifyAdmin: (...a) => middlewareImpl.verifyAdmin(...a),
}));

const productRoutes = require('../../../src/routes/productRoutes');

describe('Product Routes Integration Tests', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api/products', productRoutes);
    });

    beforeEach(() => {
        controllerImpl.getAllProducts = (req, res) => res.status(200).json([
            { name: 'iPhone 15', price: 20000000, stock: 10 }
        ]);
        controllerImpl.searchProducts = (req, res) => res.status(200).json([
            { name: 'iPhone 15 Pro', price: 25000000 }
        ]);
        controllerImpl.getProductById = (req, res) => res.status(200).json({
            _id: req.params.id, name: 'iPhone 15', price: 20000000, stock: 10
        });
        middlewareImpl.verifyAdmin = (req, res, next) => { req.user = { role: 'admin' }; next(); };
    });

    describe('GET /api/products', () => {
        test('should return all products', async () => {
            const response = await request(app).get('/api/products');
            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('GET /api/products/search', () => {
        test('should search products by keyword', async () => {
            const response = await request(app)
                .get('/api/products/search')
                .query({ keyword: 'iphone' });
            expect(response.status).toBe(200);
        });
    });

    describe('GET /api/products/:id', () => {
        test('should return product by ID', async () => {
            const response = await request(app).get('/api/products/123');
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('_id');
        });

        test('should return 404 for non-existent product', async () => {
            controllerImpl.getProductById = (req, res) =>
                res.status(404).json({ message: 'Product not found' });

            const response = await request(app).get('/api/products/999');
            expect(response.status).toBe(404);
        });
    });

    describe('POST /api/products (Admin Only)', () => {
        test('should require admin authentication', async () => {
            middlewareImpl.verifyAdmin = (req, res) =>
                res.status(403).json({ message: 'Admin access required' });

            const response = await request(app)
                .post('/api/products')
                .send({ name: 'New Product', price: 10000000 });

            expect(response.status).toBe(403);
        });

        test('should create product when admin authenticated', async () => {
            const response = await request(app)
                .post('/api/products')
                .set('token', 'Bearer admin-token')
                .send({ name: 'New Product', price: 10000000 });

            expect(response.status).toBe(201);
        });
    });

    describe('PUT /api/products/:id (Admin Only)', () => {
        test('should update product when admin authenticated', async () => {
            const response = await request(app)
                .put('/api/products/123')
                .set('token', 'Bearer admin-token')
                .send({ name: 'Updated Product', price: 15000000 });

            expect(response.status).toBe(200);
        });
    });

    describe('PUT /api/products/:id/stock (Admin Only)', () => {
        test('should update stock when admin authenticated', async () => {
            const response = await request(app)
                .put('/api/products/123/stock')
                .set('token', 'Bearer admin-token')
                .send({ stock: 20 });

            expect(response.status).toBe(200);
        });
    });

    describe('DELETE /api/products/:id (Admin Only)', () => {
        test('should delete product when admin authenticated', async () => {
            const response = await request(app)
                .delete('/api/products/123')
                .set('token', 'Bearer admin-token');

            expect(response.status).toBe(200);
        });
    });
});
