const logger = require('../config/logger');

/**
 * Global error handling middleware
 * - Logs errors with Winston (structured, persistent)
 * - Returns sanitized error response to client
 * - Shows stack trace only in development
 */
const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    // Log with full context
    logger.error(message, {
        statusCode,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userId: req.user?.id || 'anonymous',
        stack: err.stack
    });

    res.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

module.exports = errorHandler;
