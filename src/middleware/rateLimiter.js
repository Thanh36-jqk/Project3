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

// Per-minute guard: prevents burst flooding (5 req/min per IP)
const chatLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        type: 'text',
        reply: '⚠️ Bạn đang gửi tin quá nhanh. Vui lòng chờ 1 phút.'
    }
});

// Per-day guard: protects shared Gemini quota (30 req/day per IP)
const chatDailyLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        type: 'text',
        reply: '⚠️ Bạn đã dùng hết lượt chat hôm nay. Vui lòng quay lại ngày mai hoặc gọi hotline: 0962 923 329.'
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

/**
 * Rate limiter for OTP verification (prevent brute-force on 6-digit codes)
 * Strict: 5 attempts per 15 minutes per IP
 */
const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: 'Too many OTP attempts. Please request a new code.',
        retryAfter: 900
    }
});

module.exports = { authLimiter, apiLimiter, chatLimiter, chatDailyLimiter, passwordResetLimiter, otpLimiter };
