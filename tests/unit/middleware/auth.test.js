const jwt = require('jsonwebtoken');
const { verifyToken, verifyAdmin } = require('../../src/middleware/auth');

describe('Auth Middleware Tests', () => {
    let req, res, next;

    beforeEach(() => {
        req = {
            headers: {}
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        next = jest.fn();
    });

    describe('verifyToken', () => {
        test('should call next() with valid token', () => {
            const token = jwt.sign({ id: 'user123', role: 'user' }, process.env.JWT_SECRET);
            req.headers.token = `Bearer ${token}`;

            verifyToken(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(req.userId).toBe('user123');
            expect(req.userRole).toBe('user');
        });

        test('should return 401 without token', () => {
            verifyToken(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
            expect(next).not.toHaveBeenCalled();
        });

        test('should return 403 with invalid token', () => {
            req.headers.token = 'Bearer invalid-token';

            verifyToken(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({ message: 'Invalid or expired token' });
            expect(next).not.toHaveBeenCalled();
        });

        test('should return 403 with expired token', () => {
            const expiredToken = jwt.sign(
                { id: 'user123', role: 'user' },
                process.env.JWT_SECRET,
                { expiresIn: '-1s' } // Already expired
            );
            req.headers.token = `Bearer ${expiredToken}`;

            verifyToken(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });
    });

    describe('verifyAdmin', () => {
        test('should call next() for admin user', () => {
            const token = jwt.sign({ id: 'admin123', role: 'admin' }, process.env.JWT_SECRET);
            req.headers.token = `Bearer ${token}`;

            verifyAdmin(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(req.userId).toBe('admin123');
            expect(req.userRole).toBe('admin');
        });

        test('should return 403 for non-admin user', () => {
            const token = jwt.sign({ id: 'user123', role: 'user' }, process.env.JWT_SECRET);
            req.headers.token = `Bearer ${token}`;

            verifyAdmin(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({ message: 'Admin access required' });
            expect(next).not.toHaveBeenCalled();
        });

        test('should return 401 without token', () => {
            verifyAdmin(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
            expect(next).not.toHaveBeenCalled();
        });

        test('should return 403 with invalid token', () => {
            req.headers.token = 'Bearer invalid-admin-token';

            verifyAdmin(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });
    });
});
