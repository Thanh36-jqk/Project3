const request = require('supertest');
const express = require('express');

// Controllers/middleware are mocked with implementations that the route
// will capture at module-load time. Tests override behavior via the
// `controllerImpl` lookup inside each mock factory.
const controllerImpl = {
    register: (req, res) => res.status(201).json({ message: 'Đăng ký thành công!', requiresEmailVerification: true }),
    login: (req, res) => res.status(200).json({ requiresOtp: true, otpToken: 'fake-otp-token', maskedEmail: 'te***@example.com' }),
    verifyLoginOtp: (req, res) => res.status(200).json({ accessToken: 'fake-token', role: 'user' }),
    resendOtp: (req, res) => res.status(200).json({ otpToken: 'new-otp-token', maskedEmail: 'te***@example.com' }),
    getProfile: (req, res) => res.status(200).json({ email: 'x' }),
    googleCallback: (req, res) => res.redirect('/'),
    refreshAccessToken: (req, res) => res.status(200).json({ ok: true }),
    logout: (req, res) => res.status(200).json({ ok: true }),
    verifyEmail: (req, res) => res.redirect('/pages/auth/login.html?verified=true'),
    resendVerification: (req, res) => res.status(200).json({ ok: true }),
};
const passwordImpl = {
    forgotPassword: (req, res) => res.status(200).json({ ok: true }),
    resetPassword: (req, res) => res.status(200).json({ ok: true }),
};
const middlewareImpl = {
    verifyToken: (req, res, next) => { req.user = { id: 'test-user', role: 'user' }; next(); },
    verifyAdmin: (req, res, next) => { req.user = { id: 'admin', role: 'admin' }; next(); },
};

jest.mock('../../../src/controllers/authController', () => ({
    register: (...a) => controllerImpl.register(...a),
    login: (...a) => controllerImpl.login(...a),
    verifyLoginOtp: (...a) => controllerImpl.verifyLoginOtp(...a),
    resendOtp: (...a) => controllerImpl.resendOtp(...a),
    getProfile: (...a) => controllerImpl.getProfile(...a),
    googleCallback: (...a) => controllerImpl.googleCallback(...a),
    refreshAccessToken: (...a) => controllerImpl.refreshAccessToken(...a),
    logout: (...a) => controllerImpl.logout(...a),
    verifyEmail: (...a) => controllerImpl.verifyEmail(...a),
    resendVerification: (...a) => controllerImpl.resendVerification(...a),
}));
jest.mock('../../../src/controllers/passwordController', () => ({
    forgotPassword: (...a) => passwordImpl.forgotPassword(...a),
    resetPassword: (...a) => passwordImpl.resetPassword(...a),
}));
jest.mock('../../../src/middleware/auth', () => ({
    verifyToken: (...a) => middlewareImpl.verifyToken(...a),
    verifyAdmin: (...a) => middlewareImpl.verifyAdmin(...a),
}));
jest.mock('../../../src/middleware/validate', () => {
    const pass = (req, res, next) => next();
    return {
        validateRegister: [pass],
        validateLogin: [pass],
        validateForgotPassword: [pass],
        validateResetPassword: [pass],
        validateOrder: [pass],
        handleValidationErrors: pass,
    };
});
jest.mock('../../../src/middleware/rateLimiter', () => ({
    authLimiter: (req, res, next) => next(),
    apiLimiter: (req, res, next) => next(),
    chatLimiter: (req, res, next) => next(),
    passwordResetLimiter: (req, res, next) => next(),
    otpLimiter: (req, res, next) => next(),
}));
jest.mock('passport', () => ({
    authenticate: jest.fn(() => (req, res, next) => res.redirect('/')),
    initialize: jest.fn(() => (req, res, next) => next()),
    session: jest.fn(() => (req, res, next) => next()),
    use: jest.fn(),
    serializeUser: jest.fn(),
    deserializeUser: jest.fn(),
}));

const authRoutes = require('../../../src/routes/authRoutes');

describe('Auth Routes Integration Tests', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/', authRoutes);
    });

    beforeEach(() => {
        // Reset to defaults
        controllerImpl.register = (req, res) => res.status(201).json({ message: 'Registration successful' });
        controllerImpl.login = (req, res) => res.status(200).json({ requiresOtp: true, otpToken: 'fake-otp-token', maskedEmail: 'te***@example.com' });
        controllerImpl.verifyLoginOtp = (req, res) => res.status(200).json({ accessToken: 'fake-token', role: 'user' });
        controllerImpl.getProfile = (req, res) => res.status(200).json({ email: 'x' });
        middlewareImpl.verifyToken = (req, res, next) => { req.user = { id: 'test', role: 'user' }; next(); };
    });

    describe('POST /api/register', () => {
        test('should call authController.register', async () => {
            const response = await request(app)
                .post('/api/register')
                .send({ email: 'test@example.com', password: 'password123' });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('message');
        });

        test('should handle registration with missing fields', async () => {
            controllerImpl.register = (req, res) => res.status(400).json({ message: 'Email and password required' });

            const response = await request(app)
                .post('/api/register')
                .send({ email: 'test@example.com' });

            expect(response.status).toBe(400);
        });
    });

    describe('POST /api/login', () => {
        test('should call authController.login and return OTP flow for regular users', async () => {
            const response = await request(app)
                .post('/api/login')
                .send({ email: 'test@example.com', password: 'password123' });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('requiresOtp', true);
            expect(response.body).toHaveProperty('otpToken');
        });

        test('should handle invalid credentials', async () => {
            controllerImpl.login = (req, res) => res.status(401).json({ message: 'Invalid credentials' });

            const response = await request(app)
                .post('/api/login')
                .send({ email: 'test@example.com', password: 'wrongpassword' });

            expect(response.status).toBe(401);
        });
    });

    describe('GET /api/users/profile', () => {
        test('should require authentication', async () => {
            middlewareImpl.verifyToken = (req, res) => res.status(401).json({ message: 'Unauthorized' });

            const response = await request(app).get('/api/users/profile');

            expect(response.status).toBe(401);
        });

        test('should return user profile when authenticated', async () => {
            controllerImpl.getProfile = (req, res) => res.status(200).json({
                email: 'test@example.com', role: 'user', rank: 'Silver', points: 100
            });

            const response = await request(app)
                .get('/api/users/profile')
                .set('token', 'Bearer fake-token');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('email');
        });
    });

    describe('Google OAuth Routes', () => {
        test('GET /auth/google should redirect', async () => {
            const response = await request(app).get('/auth/google');
            expect([302, 500]).toContain(response.status);
        });

        test('GET /auth/google/callback should handle callback', async () => {
            const response = await request(app).get('/auth/google/callback');
            expect([302, 500]).toContain(response.status);
        });
    });
});
