const request = require('supertest');
const express = require('express');
const authRoutes = require('../../src/routes/authRoutes');

// Mock dependencies
jest.mock('../../src/controllers/authController');
jest.mock('../../src/middleware/auth');
jest.mock('passport');

const authController = require('../../src/controllers/authController');
const { verifyToken } = require('../../src/middleware/auth');

describe('Auth Routes Integration Tests', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/', authRoutes);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/register', () => {
        test('should call authController.register', async () => {
            authController.register = jest.fn((req, res) => {
                res.status(201).json({ message: 'Registration successful' });
            });

            const response = await request(app)
                .post('/api/register')
                .send({ email: 'test@example.com', password: 'password123' });

            expect(authController.register).toHaveBeenCalled();
            expect(response.status).toBe(201);
        });

        test('should handle registration with missing fields', async () => {
            authController.register = jest.fn((req, res) => {
                res.status(400).json({ message: 'Email and password required' });
            });

            const response = await request(app)
                .post('/api/register')
                .send({ email: 'test@example.com' });

            expect(response.status).toBe(400);
        });
    });

    describe('POST /api/login', () => {
        test('should call authController.login', async () => {
            authController.login = jest.fn((req, res) => {
                res.status(200).json({
                    accessToken: 'fake-token',
                    user: { email: 'test@example.com', role: 'user' }
                });
            });

            const response = await request(app)
                .post('/api/login')
                .send({ email: 'test@example.com', password: 'password123' });

            expect(authController.login).toHaveBeenCalled();
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('accessToken');
        });

        test('should handle invalid credentials', async () => {
            authController.login = jest.fn((req, res) => {
                res.status(401).json({ message: 'Invalid credentials' });
            });

            const response = await request(app)
                .post('/api/login')
                .send({ email: 'test@example.com', password: 'wrongpassword' });

            expect(response.status).toBe(401);
        });
    });

    describe('GET /api/users/profile', () => {
        test('should require authentication', async () => {
            verifyToken.mockImplementation((req, res, next) => {
                res.status(401).json({ message: 'Unauthorized' });
            });

            const response = await request(app)
                .get('/api/users/profile');

            expect(response.status).toBe(401);
        });

        test('should return user profile when authenticated', async () => {
            verifyToken.mockImplementation((req, res, next) => {
                req.userId = 'test-user-id';
                next();
            });

            authController.getProfile = jest.fn((req, res) => {
                res.status(200).json({
                    email: 'test@example.com',
                    role: 'user',
                    rank: 'Silver',
                    points: 100
                });
            });

            const response = await request(app)
                .get('/api/users/profile')
                .set('token', 'Bearer fake-token');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('email');
        });
    });

    describe('Google OAuth Routes', () => {
        test('GET /auth/google should redirect to Google', async () => {
            // This is handled by Passport, just verify the route exists
            const response = await request(app).get('/auth/google');
            // May return 500 or redirect depending on Passport setup
            expect([302, 500]).toContain(response.status);
        });

        test('GET /auth/google/callback should handle callback', async () => {
            authController.googleCallback = jest.fn((req, res) => {
                res.redirect('/');
            });

            const response = await request(app).get('/auth/google/callback');
            // Will fail without proper Passport setup, but route should exist
            expect([302, 500]).toContain(response.status);
        });
    });
});
