const errorHandler = require('../../src/middleware/errorHandler');

describe('Error Handler Middleware Tests', () => {
    let req, res, next;

    beforeEach(() => {
        req = {};
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        next = jest.fn();
    });

    test('should send error response with status code', () => {
        const error = new Error('Test error');
        error.status = 404;

        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            message: 'Test error',
            stack: expect.any(String)
        });
    });

    test('should default to 500 status code if not specified', () => {
        const error = new Error('Server error');

        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
    });

    test('should include stack trace in development', () => {
        process.env.NODE_ENV = 'development';
        const error = new Error('Dev error');

        errorHandler(error, req, res, next);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Dev error',
            stack: expect.any(String)
        });
    });

    test('should hide stack trace in production', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        const error = new Error('Production error');

        errorHandler(error, req, res, next);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Production error'
        });

        process.env.NODE_ENV = originalEnv;
    });
});
