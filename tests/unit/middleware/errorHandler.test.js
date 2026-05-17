// Mock logger to avoid Winston file-transport side effects during tests
jest.mock('../../../src/config/logger', () => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
}));

const errorHandler = require('../../../src/middleware/errorHandler');

describe('Error Handler Middleware Tests', () => {
    let req, res, next;
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
        req = {
            method: 'GET',
            originalUrl: '/test',
            ip: '127.0.0.1'
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        next = jest.fn();
    });

    afterEach(() => {
        process.env.NODE_ENV = originalEnv;
    });

    test('should send error response with status code from err.statusCode', () => {
        const error = new Error('Test error');
        error.statusCode = 404;

        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                message: 'Test error'
            })
        );
    });

    test('should default to 500 status code if not specified', () => {
        const error = new Error('Server error');

        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                message: 'Server error'
            })
        );
    });

    test('should include stack trace in development', () => {
        process.env.NODE_ENV = 'development';
        const error = new Error('Dev error');

        errorHandler(error, req, res, next);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                message: 'Dev error',
                stack: expect.any(String)
            })
        );
    });

    test('should hide stack trace in production', () => {
        process.env.NODE_ENV = 'production';
        const error = new Error('Production error');

        errorHandler(error, req, res, next);

        const payload = res.json.mock.calls[0][0];
        expect(payload).toEqual({
            success: false,
            message: 'Production error'
        });
        expect(payload).not.toHaveProperty('stack');
    });

    test('should default error message to "Internal Server Error"', () => {
        const error = new Error();

        errorHandler(error, req, res, next);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'Internal Server Error'
            })
        );
    });
});
