const request = require('supertest');
const express = require('express');
const productRoutes = require('../../src/routes/productRoutes');

// Mock dependencies
jest.mock('../../src/controllers/productController');
jest.mock('../../src/middleware/auth');

const productController = require('../../src/controllers/productController');
const { verifyAdmin } = require('../../src/middleware/auth');

describe('Product Routes Integration Tests', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api/products', productRoutes);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/products', () => {
        test('should return all products', async () => {
            productController.getAllProducts = jest.fn((req, res) => {
                res.status(200).json([
                    { name: 'iPhone 15', price: 20000000, stock: 10 },
                    { name: 'MacBook Pro', price: 45000000, stock: 5 }
                ]);
            });

            const response = await request(app).get('/api/products');

            expect(productController.getAllProducts).toHaveBeenCalled();
            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('GET /api/products/search', () => {
        test('should search products by keyword', async () => {
            productController.searchProducts = jest.fn((req, res) => {
                res.status(200).json([
                    { name: 'iPhone 15 Pro', price: 25000000 }
                ]);
            });

            const response = await request(app)
                .get('/api/products/search')
                .query({ keyword: 'iphone' });

            expect(productController.searchProducts).toHaveBeenCalled();
            expect(response.status).toBe(200);
        });
    });

    describe('GET /api/products/:id', () => {
        test('should return product by ID', async () => {
            productController.getProductById = jest.fn((req, res) => {
                res.status(200).json({
                    _id: '123',
                    name: 'iPhone 15',
                    price: 20000000,
                    stock: 10
                });
            });

            const response = await request(app).get('/api/products/123');

            expect(productController.getProductById).toHaveBeenCalled();
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('_id');
        });

        test('should return 404 for non-existent product', async () => {
            productController.getProductById = jest.fn((req, res) => {
                res.status(404).json({ message: 'Product not found' });
            });

            const response = await request(app).get('/api/products/999');

            expect(response.status).toBe(404);
        });
    });

    describe('POST /api/products (Admin Only)', () => {
        test('should require admin authentication', async () => {
            verifyAdmin.mockImplementation((req, res, next) => {
                res.status(403).json({ message: 'Admin access required' });
            });

            const response = await request(app)
                .post('/api/products')
                .send({ name: 'New Product', price: 10000000 });

            expect(response.status).toBe(403);
        });

        test('should create product when admin authenticated', async () => {
            verifyAdmin.mockImplementation((req, res, next) => {
                req.user = { role: 'admin' };
                next();
            });

            productController.createProduct = jest.fn((req, res) => {
                res.status(201).json({
                    _id: 'new-id',
                    name: 'New Product',
                    price: 10000000
                });
            });

            const response = await request(app)
                .post('/api/products')
                .set('token', 'Bearer admin-token')
                .send({ name: 'New Product', price: 10000000 });

            expect(response.status).toBe(201);
        });
    });

    describe('PUT /api/products/:id (Admin Only)', () => {
        test('should update product when admin authenticated', async () => {
            verifyAdmin.mockImplementation((req, res, next) => {
                req.user = { role: 'admin' };
                next();
            });

            productController.updateProduct = jest.fn((req, res) => {
                res.status(200).json({
                    _id: '123',
                    name: 'Updated Product',
                    price: 15000000
                });
            });

            const response = await request(app)
                .put('/api/products/123')
                .set('token', 'Bearer admin-token')
                .send({ name: 'Updated Product', price: 15000000 });

            expect(response.status).toBe(200);
        });
    });

    describe('PUT /api/products/:id/stock (Admin Only)', () => {
        test('should update stock when admin authenticated', async () => {
            verifyAdmin.mockImplementation((req, res, next) => {
                req.user = { role: 'admin' };
                next();
            });

            productController.updateStock = jest.fn((req, res) => {
                res.status(200).json({
                    _id: '123',
                    stock: 20
                });
            });

            const response = await request(app)
                .put('/api/products/123/stock')
                .set('token', 'Bearer admin-token')
                .send({ stock: 20 });

            expect(response.status).toBe(200);
        });
    });

    describe('DELETE /api/products/:id (Admin Only)', () => {
        test('should delete product when admin authenticated', async () => {
            verifyAdmin.mockImplementation((req, res, next) => {
                req.user = { role: 'admin' };
                next();
            });

            productController.deleteProduct = jest.fn((req, res) => {
                res.status(200).json({ message: 'Product deleted successfully' });
            });

            const response = await request(app)
                .delete('/api/products/123')
                .set('token', 'Bearer admin-token');

            expect(response.status).toBe(200);
        });
    });
});
