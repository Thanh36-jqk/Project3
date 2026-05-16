const prisma = require('../config/postgres');
const Product = require('../models/Product');
const Voucher = require('../models/Voucher');

exports.getDashboardStats = async (req, res) => {
    try {
        const totalProducts = await Product.countDocuments();
        const totalOrders = await prisma.order.count();
        const totalUsers = await prisma.user.count();
        const revenueAgg = await prisma.order.aggregate({ _sum: { finalAmount: true } });

        res.status(200).json({
            totalProducts,
            totalOrders,
            totalUsers,
            totalRevenue: revenueAgg._sum.finalAmount || 0
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getAllProducts = async (req, res) => {
    try {
        const products = await Product.find().sort({ name: 1 });
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getAllOrders = async (req, res) => {
    try {
        const orders = await prisma.order.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                user: { select: { email: true, rank: true } },
                items: true
            }
        });
        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const allowedStatuses = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
        if (!status || !allowedStatuses.includes(status)) {
            return res.status(400).json({ message: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` });
        }
        const order = await prisma.order.update({
            where: { id: req.params.id },
            data: { status }
        });
        res.status(200).json(order);
    } catch (error) {
        if (error.code === 'P2025') return res.status(404).json({ message: 'Order not found' });
        res.status(500).json({ message: error.message });
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true, name: true, email: true, role: true, rank: true,
                points: true, totalSpending: true, createdAt: true, avatar: true, phone: true
            },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateUserRank = async (req, res) => {
    try {
        const { rank } = req.body;
        const allowedRanks = ['Silver', 'Gold', 'VIP'];
        if (!rank || !allowedRanks.includes(rank)) {
            return res.status(400).json({ message: `Invalid rank. Allowed: ${allowedRanks.join(', ')}` });
        }
        const user = await prisma.user.update({
            where: { id: req.params.id },
            data: { rank },
            select: { id: true, name: true, email: true, role: true, rank: true, points: true }
        });
        res.status(200).json(user);
    } catch (error) {
        if (error.code === 'P2025') return res.status(404).json({ message: 'User not found' });
        res.status(500).json({ message: error.message });
    }
};

exports.getAllVouchers = async (req, res) => {
    try {
        const vouchers = await Voucher.find().sort({ createdAt: -1 });
        res.status(200).json(vouchers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createVoucher = async (req, res) => {
    try {
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

exports.updateVoucher = async (req, res) => {
    try {
        const { code, discountAmount, pointsRequired, quantity, isActive } = req.body;
        const updateData = {};
        if (code !== undefined) updateData.code = code;
        if (discountAmount !== undefined) updateData.discountAmount = discountAmount;
        if (pointsRequired !== undefined) updateData.pointsRequired = pointsRequired;
        if (quantity !== undefined) updateData.quantity = quantity;
        if (isActive !== undefined) updateData.isActive = isActive;

        const voucher = await Voucher.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!voucher) return res.status(404).json({ message: 'Voucher not found' });
        res.status(200).json(voucher);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.deleteVoucher = async (req, res) => {
    try {
        await Voucher.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'Voucher deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
