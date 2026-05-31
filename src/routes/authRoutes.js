const express = require('express');
const router = express.Router();
const passport = require('passport');
const authController = require('../controllers/authController');
const passwordController = require('../controllers/passwordController');
const { verifyToken } = require('../middleware/auth');
const { validateRegister, validateLogin, validateForgotPassword, validateResetPassword } = require('../middleware/validate');
const { authLimiter, passwordResetLimiter, otpLimiter } = require('../middleware/rateLimiter');

// Register and Login (with validation + rate limiting)
router.post('/api/register', authLimiter, validateRegister, authController.register);
router.post('/api/login', authLimiter, validateLogin, authController.login);

// Email verification
router.get('/api/auth/verify-email', authController.verifyEmail);
router.post('/api/auth/resend-verification', authLimiter, authController.resendVerification);

// Login step 2 — OTP verification
router.post('/api/auth/verify-otp', otpLimiter, authController.verifyLoginOtp);

// Resend OTP (same rate limit as verify-otp)
router.post('/api/auth/resend-otp', otpLimiter, authController.resendOtp);

// Token management
router.post('/api/auth/refresh', authController.refreshAccessToken);
router.post('/api/auth/logout', authController.logout);

// Password reset (with rate limiting to prevent email spam)
router.post('/api/auth/forgot-password', passwordResetLimiter, validateForgotPassword, passwordController.forgotPassword);
router.post('/api/auth/reset-password', passwordResetLimiter, validateResetPassword, passwordController.resetPassword);

// Google OAuth
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/pages/auth/login.html' }), authController.googleCallback);

// User Profile
router.get('/api/users/profile', verifyToken, authController.getProfile);

module.exports = router;
