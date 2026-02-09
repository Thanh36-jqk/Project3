const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Order = require('../models/Order');

/**
 * Register new user
 */
exports.register = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const role = email.includes('admin') ? 'admin' : 'user';

        const newUser = new User({
            email,
            password: hashedPassword,
            role,
            rank: 'Silver'
        });
        await newUser.save();
        res.status(201).json({ message: 'Registration successful' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Login user
 */
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid password' });
        }

        const accessToken = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "3d" }
        );
        const { password: p, ...userInfo } = user._doc;
        res.status(200).json({ ...userInfo, accessToken });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get user profile with orders
 */
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        const orders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json({ user, orders });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Google OAuth callback handler
 */
exports.googleCallback = (req, res) => {
    // Create JWT token for authenticated user
    const accessToken = jwt.sign(
        { id: req.user._id, role: req.user.role },
        process.env.JWT_SECRET,
        { expiresIn: "3d" }
    );

    // Redirect to homepage with token
    const redirectUrl = process.env.FRONTEND_URL || 'https://project3-icy1.onrender.com';
    res.redirect(`${redirectUrl}/?token=${accessToken}`);
};
