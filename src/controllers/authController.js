const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Order = require('../models/Order');
const RefreshToken = require('../models/RefreshToken');
const { mergeGuestCart } = require('../services/cartMergeService');

// Access token: short-lived (15 minutes)
const ACCESS_TOKEN_EXPIRY = '15m';
// Refresh token: long-lived (30 days)
const REFRESH_TOKEN_DAYS = 30;

/**
 * Helper: Generate a short-lived access token
 */
function generateAccessToken(user) {
    return jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
}

/**
 * Helper: Set refresh token as httpOnly cookie
 */
function setRefreshCookie(res, rawToken) {
    res.cookie('refreshToken', rawToken, {
        httpOnly: true,                                         // Not accessible via JavaScript (XSS-safe)
        secure: process.env.NODE_ENV === 'production',          // HTTPS only in production
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,      // 30 days
        path: '/'
    });
}

/**
 * Register new user
 * POST /api/register
 */
exports.register = async (req, res) => {
    try {
        const { email, password, name } = req.body;

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        // SECURITY: Admin role must be assigned manually via DB or super-admin API.
        const role = 'user';

        const newUser = new User({
            email: email.toLowerCase(),
            password: hashedPassword,
            name: name || '',
            role,
            rank: 'Silver'
        });
        await newUser.save();

        // Merge guest cart if provided
        if (req.body.guestCart && Array.isArray(req.body.guestCart) && req.body.guestCart.length > 0) {
            await mergeGuestCart(newUser._id, req.body.guestCart);
        }

        res.status(201).json({ message: 'Registration successful' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Login user — returns access token + sets refresh token cookie
 * POST /api/login
 */
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Google OAuth users without a password must use Google login
        if (!user.password) {
            return res.status(401).json({ message: 'This account uses Google Sign-In. Please log in with Google.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Generate tokens
        const accessToken = generateAccessToken(user);
        const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
        const { rawToken } = await RefreshToken.createToken(user._id, clientIp, REFRESH_TOKEN_DAYS);

        // Set refresh token as httpOnly cookie
        setRefreshCookie(res, rawToken);

        // Merge guest cart if provided
        if (req.body.guestCart && Array.isArray(req.body.guestCart) && req.body.guestCart.length > 0) {
            await mergeGuestCart(user._id, req.body.guestCart);
        }

        const { password: p, passwordResetToken: prt, passwordResetExpires: pre, ...userInfo } = user._doc;
        res.status(200).json({ ...userInfo, accessToken });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Refresh access token using refresh token from cookie
 * POST /api/auth/refresh
 */
exports.refreshAccessToken = async (req, res) => {
    try {
        const token = req.cookies?.refreshToken;
        if (!token) {
            return res.status(401).json({ message: 'No refresh token provided' });
        }

        // Find the refresh token in DB
        const storedToken = await RefreshToken.findOne({ token });
        if (!storedToken) {
            return res.status(403).json({ message: 'Invalid refresh token — please log in again' });
        }

        // Check expiry
        if (storedToken.expiresAt < new Date()) {
            await RefreshToken.deleteOne({ _id: storedToken._id });
            return res.status(403).json({ message: 'Refresh token expired — please log in again' });
        }

        // Find the user
        const user = await User.findById(storedToken.userId);
        if (!user) {
            await RefreshToken.deleteOne({ _id: storedToken._id });
            return res.status(403).json({ message: 'User not found' });
        }

        // Issue new access token
        const accessToken = generateAccessToken(user);
        res.status(200).json({ accessToken });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Logout — revoke refresh token
 * POST /api/auth/logout
 */
exports.logout = async (req, res) => {
    try {
        const token = req.cookies?.refreshToken;
        if (token) {
            await RefreshToken.deleteOne({ token });
        }

        // Clear the cookie
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            path: '/'
        });

        res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get user profile with orders
 * GET /api/users/profile
 */
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password -passwordResetToken -passwordResetExpires -emailVerificationToken');
        const orders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json({ user, orders });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Google OAuth callback handler
 */
exports.googleCallback = async (req, res) => {
    try {
        const accessToken = generateAccessToken(req.user);

        // Also create a refresh token for Google OAuth users
        const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
        const { rawToken } = await RefreshToken.createToken(req.user._id, clientIp, REFRESH_TOKEN_DAYS);
        setRefreshCookie(res, rawToken);

        // Redirect to homepage with access token
        const redirectUrl = process.env.FRONTEND_URL || 'https://project3-icy1.onrender.com';
        res.redirect(`${redirectUrl}/?token=${accessToken}`);
    } catch (error) {
        console.error('Google callback error:', error);
        res.redirect('/pages/auth/login.html?error=oauth_failed');
    }
};
