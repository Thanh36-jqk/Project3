const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for authentication endpoints (login, register)
 * Strict: 5 requests per minute per IP
 */
const authLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,   // 1 minute
    max: 5,                     // 5 attempts
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: 'Too many attempts. Please try again after 1 minute.',
        retryAfter: 60
    }
});

/**
 * Rate limiter for general API endpoints
 * Moderate: 100 requests per minute per IP
 */
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: 'Too many requests. Please slow down.',
        retryAfter: 60
    }
});

/**
 * Rate limiter for AI chatbot endpoint
 * Moderate: 20 requests per minute per IP (API calls are expensive)
 */
const chatLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: 'Chatbot rate limit reached. Please wait a moment.',
        retryAfter: 60
    }
});

/**
 * Rate limiter for password reset (prevent email spam)
 * Strict: 3 requests per 15 minutes per IP
 */
const passwordResetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: 'Too many password reset requests. Please try again later.',
        retryAfter: 900
    }
});

module.exports = { authLimiter, apiLimiter, chatLimiter, passwordResetLimiter };
