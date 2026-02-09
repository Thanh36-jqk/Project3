const express = require('express');
const router = express.Router();
const passport = require('passport');
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

// Register and Login
router.post('/api/register', authController.register);
router.post('/api/login', authController.login);

// Google OAuth
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/pages/auth/login.html' }), authController.googleCallback);

// User Profile
router.get('/api/users/profile', verifyToken, authController.getProfile);

module.exports = router;
