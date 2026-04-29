const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const Voucher = require('../models/Voucher');

/**
 * Get admin dashboard statistics
 */
exports.getDashboardStats = async (req, res) => {
    try {
        const totalProducts = await Product.countDocuments();
        const totalOrders = await Order.countDocuments();
        const totalUsers = await User.countDocuments();
        const totalRevenue = await Order.aggregate([
            { $group: { _id: null, total: { $sum: '$finalAmount' } } }
        ]);

        res.status(200).json({
            totalProducts,
            totalOrders,
            totalUsers,
            totalRevenue: totalRevenue[0]?.total || 0
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get all products (Admin)
 */
exports.getAllProducts = async (req, res) => {
    try {
        const products = await Product.find().sort({ name: 1 });
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get all orders (Admin)
 */
exports.getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find()
            .sort({ createdAt: -1 })
            .populate('userId', 'email rank');
        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Update order status (Admin)
 */
exports.updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const allowedStatuses = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
        if (!status || !allowedStatuses.includes(status)) {
            return res.status(400).json({ message: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` });
        }
        const order = await Order.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );
        if (!order) return res.status(404).json({ message: 'Order not found' });
        res.status(200).json(order);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get all users (Admin)
 */
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find()
            .select('-password')
            .sort({ createdAt: -1 });
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Update user rank (Admin)
 */
exports.updateUserRank = async (req, res) => {
    try {
        const { rank } = req.body;
        const allowedRanks = ['Silver', 'Gold', 'VIP'];
        if (!rank || !allowedRanks.includes(rank)) {
            return res.status(400).json({ message: `Invalid rank. Allowed: ${allowedRanks.join(', ')}` });
        }
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { rank },
            { new: true }
        ).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get all vouchers (Admin)
 */
exports.getAllVouchers = async (req, res) => {
    try {
        const vouchers = await Voucher.find().sort({ createdAt: -1 });
        res.status(200).json(vouchers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Create new voucher (Admin)
 */
exports.createVoucher = async (req, res) => {
    try {
        // Whitelist: only allow known fields to prevent mass assignment
        const { code, discountAmount, pointsRequired, quantity, isActive } = req.body;
        if (!code || discountAmount == null || pointsRequired == null) {
            return res.status(400).json({ message: 'code, discountAmount, and pointsRequired are required' });
        }
        const newVoucher = new Voucher({ code, discountAmount, pointsRequired, quantity, isActive });
        await newVoucher.save();
        res.status(201).json(newVoucher);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Update voucher (Admin)
 */
exports.updateVoucher = async (req, res) => {
    try {
        // Whitelist: only allow known fields
        const { code, discountAmount, pointsRequired, quantity, isActive } = req.body;
        const updateData = {};
        if (code !== undefined) updateData.code = code;
        if (discountAmount !== undefined) updateData.discountAmount = discountAmount;
        if (pointsRequired !== undefined) updateData.pointsRequired = pointsRequired;
        if (quantity !== undefined) updateData.quantity = quantity;
        if (isActive !== undefined) updateData.isActive = isActive;

        const voucher = await Voucher.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );
        if (!voucher) return res.status(404).json({ message: 'Voucher not found' });
        res.status(200).json(voucher);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Delete voucher (Admin)
 */
exports.deleteVoucher = async (req, res) => {
    try {
        await Voucher.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'Voucher deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
