const mongoose = require('mongoose');
const prisma = require('../config/postgres');
const Product = require('../models/Product');
const logger = require('../config/logger');
const Voucher = require('../models/Voucher');
const Review = require('../models/Review');
const { sendEmail } = require('../services/emailService');
const { buildCancellationEmail } = require('../utils/emailTemplates');
const { recalculateProductRatings } = require('./reviewController');
const { pushAudit, getAuditLogs } = require('../utils/auditLog');

const ORDER_STATUS_CONFIG = {
    Confirmed:  { subject: 'Order Confirmed — Apple Store',          color: '#0071e3', headline: 'Your order has been confirmed',    body: 'Great news! We\'ve confirmed your order and our team is getting it ready.' },
    Processing: { subject: 'Your Order Is Being Prepared',           color: '#f39c12', headline: 'Your order is being packed',        body: 'Our team is carefully packaging your items for shipment.' },
    Shipped:    { subject: 'Your Order Is On Its Way — Apple Store', color: '#27ae60', headline: 'Your order has shipped',            body: 'Your package is on its way. You\'ll receive it soon.' },
    Completed:  { subject: 'Order Delivered — Apple Store',          color: '#27ae60', headline: 'Your order has been delivered',     body: 'We hope you love your new Apple product. Thank you for shopping with us!' },
    Cancelled:  { subject: 'Order Cancelled — Apple Store',          color: '#e74c3c', headline: 'Your order has been cancelled',     body: 'Your order has been cancelled. If you have any questions, contact our support team.' },
};

async function sendOrderStatusEmail(recipientEmail, recipientName, order, status) {
    const config = ORDER_STATUS_CONFIG[status];
    if (!config) return;

    const html = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Inter',Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f5f5f7;border-radius:16px;">
            <div style="background:#ffffff;border-radius:12px;padding:40px;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
                <div style="text-align:center;margin-bottom:32px;">
                    <span style="font-size:40px;font-weight:700;letter-spacing:-1px;color:#1d1d1f;">&#63743;</span>
                    <p style="color:#86868b;font-size:13px;margin:4px 0 0;">Apple Store</p>
                </div>
                <div style="text-align:center;margin-bottom:28px;">
                    <div style="display:inline-block;background:${config.color}1a;border-radius:50%;width:56px;height:56px;line-height:56px;text-align:center;margin-bottom:16px;">
                        <div style="width:12px;height:12px;background:${config.color};border-radius:50%;display:inline-block;vertical-align:middle;"></div>
                    </div>
                    <h1 style="color:#1d1d1f;font-size:22px;font-weight:700;margin:0 0 8px;">${config.headline}</h1>
                    <p style="color:#86868b;font-size:15px;margin:0;">Hello, ${recipientName || 'Customer'}</p>
                </div>
                <p style="color:#1d1d1f;font-size:15px;text-align:center;margin-bottom:28px;">${config.body}</p>
                <div style="background:#f5f5f7;border-radius:10px;padding:20px;margin-bottom:28px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
                        <span style="color:#86868b;font-size:13px;">Order ID</span>
                        <span style="color:#1d1d1f;font-size:13px;font-weight:600;font-family:monospace;">#${order.id.slice(-8).toUpperCase()}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
                        <span style="color:#86868b;font-size:13px;">Status</span>
                        <span style="color:${config.color};font-size:13px;font-weight:700;text-transform:uppercase;">${status}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;">
                        <span style="color:#86868b;font-size:13px;">Total</span>
                        <span style="color:#1d1d1f;font-size:13px;font-weight:600;">${(order.finalAmount || 0).toLocaleString('vi-VN')}&#8363;</span>
                    </div>
                </div>
                <hr style="border:none;border-top:1px solid #f0f0f0;margin:0 0 20px;" />
                <p style="color:#86868b;font-size:12px;text-align:center;margin:0;">&copy; ${new Date().getFullYear()} Apple Store Clone. All rights reserved.</p>
            </div>
        </div>`;

    const emailData = { to: recipientEmail, subject: config.subject, html };
    await sendEmail(emailData);
}

exports.getDashboardStats = async (req, res) => {
    try {
        const totalProducts = await Product.countDocuments();
        const totalOrders = await prisma.order.count();
        const totalUsers = await prisma.user.count();
        const revenueAgg = await prisma.order.aggregate({ where: { status: { in: ['Confirmed', 'Completed'] } }, _sum: { finalAmount: true } });

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
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;

        const [products, total] = await Promise.all([
            Product.find().sort({ name: 1 }).skip(skip).limit(limit),
            Product.countDocuments()
        ]);

        res.status(200).json({ data: products, total, page, pages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getAllOrders = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: { select: { email: true, rank: true } },
                    items: true
                }
            }),
            prisma.order.count()
        ]);

        res.status(200).json({ data: orders, total, page, pages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const allowedStatuses = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Completed', 'Cancelled'];
        if (!status || !allowedStatuses.includes(status)) {
            return res.status(400).json({ message: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` });
        }
        const order = await prisma.order.update({
            where: { id: req.params.id },
            data: { status },
            include: { user: { select: { email: true, name: true } } }
        });

        logger.info('ADMIN_AUDIT', { action: 'updateOrderStatus', adminId: req.user?.id, orderId: req.params.id, status });
        pushAudit('updateOrderStatus', { adminId: req.user?.id, orderId: req.params.id, status });

        const recipientEmail = order.user?.email || order.guestEmail;
        if (recipientEmail) {
            sendOrderStatusEmail(recipientEmail, order.user?.name || order.recipientName, order, status)
                .catch(err => console.error('Order status email failed:', err.message));
        }

        res.status(200).json(order);
    } catch (error) {
        if (error.code === 'P2025') return res.status(404).json({ message: 'Order not found' });
        res.status(500).json({ message: error.message });
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                skip,
                take: limit,
                select: {
                    id: true, name: true, email: true, role: true, rank: true,
                    points: true, totalSpending: true, createdAt: true, avatar: true, phone: true
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.user.count()
        ]);

        res.status(200).json({ data: users, total, page, pages: Math.ceil(total / limit) });
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
        logger.info('ADMIN_AUDIT', { action: 'updateUserRank', adminId: req.user?.id, targetUserId: req.params.id, rank });
        pushAudit('updateUserRank', { adminId: req.user?.id, targetUserId: req.params.id, rank });
        res.status(200).json(user);
    } catch (error) {
        if (error.code === 'P2025') return res.status(404).json({ message: 'User not found' });
        res.status(500).json({ message: error.message });
    }
};

exports.getAllVouchers = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;
        const [vouchers, total] = await Promise.all([
            Voucher.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
            Voucher.countDocuments()
        ]);
        res.status(200).json({ data: vouchers, total, page, pages: Math.ceil(total / limit) });
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
        if (error.code === 11000) return res.status(409).json({ message: 'Voucher code already exists' });
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
        const voucher = await Voucher.findByIdAndDelete(req.params.id);
        if (!voucher) return res.status(404).json({ message: 'Voucher not found' });
        res.status(200).json({ message: 'Voucher deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Admin cancel order — can cancel Pending/Confirmed/Processing/Shipped orders
 * PUT /api/admin/orders/:id/cancel
 */
exports.cancelOrderAdmin = async (req, res) => {
    try {
        const { reason } = req.body;
        const order = await prisma.order.findUnique({
            where: { id: req.params.id },
            include: {
                items: true,
                user: { select: { email: true, name: true, points: true, totalSpending: true } }
            }
        });

        if (!order) return res.status(404).json({ message: 'Order not found' });
        if (order.status === 'Cancelled') return res.status(400).json({ message: 'Order is already cancelled' });

        const nonCancellable = ['Completed', 'Delivered'];
        if (nonCancellable.includes(order.status)) {
            return res.status(400).json({ message: `Cannot cancel a ${order.status} order` });
        }

        const cancelReason = reason?.trim() || 'Cancelled by admin';
        const originalStatus = order.status;

        await prisma.order.update({
            where: { id: req.params.id },
            data: { status: 'Cancelled', cancelReason }
        });

        // Restore stock
        for (const item of order.items) {
            if (mongoose.Types.ObjectId.isValid(item.productId)) {
                await Product.updateOne({ _id: item.productId }, { $inc: { stock: item.qty } });
            }
        }

        // Restore voucher
        if (order.appliedVoucher && order.userId) {
            await prisma.voucher.updateMany({
                where: { userId: order.userId, code: order.appliedVoucher, isUsed: true },
                data: { isUsed: false }
            });
        }

        // Deduct points if order was finalized
        const wasFinalized = ['Confirmed', 'Processing', 'Shipped'].includes(originalStatus);
        if (wasFinalized && order.userId && order.user) {
            const pointsEarned = Math.floor(order.finalAmount / 100000);
            if (pointsEarned > 0) {
                await prisma.user.update({
                    where: { id: order.userId },
                    data: {
                        points: Math.max(0, (order.user.points || 0) - pointsEarned),
                        totalSpending: Math.max(0, (order.user.totalSpending || 0) - order.finalAmount)
                    }
                });
            }
        }

        // Send cancellation email
        const recipientEmail = order.user?.email || order.guestEmail;
        if (recipientEmail) {
            sendEmail({
                to: recipientEmail,
                subject: 'Đơn hàng đã bị hủy — Apple Store',
                html: buildCancellationEmail(
                    order.user?.name || order.recipientName,
                    { ...order, status: 'Cancelled' },
                    cancelReason
                )
            }).catch(err => console.error('Admin cancellation email failed:', err.message));
        }

        logger.info('ADMIN_AUDIT', { action: 'cancelOrderAdmin', adminId: req.user?.id, orderId: req.params.id, reason: cancelReason });
        pushAudit('cancelOrderAdmin', { adminId: req.user?.id, orderId: req.params.id, reason: cancelReason });
        res.status(200).json({ message: 'Order cancelled successfully' });
    } catch (error) {
        if (error.code === 'P2025') return res.status(404).json({ message: 'Order not found' });
        res.status(500).json({ message: error.message });
    }
};

function escapeCSV(val) {
    if (val == null) return '';
    const s = String(val);
    return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
}

// GET /api/admin/orders/export?format=csv
exports.exportOrders = async (req, res) => {
    try {
        const orders = await prisma.order.findMany({
            orderBy: { createdAt: 'desc' },
            include: { user: { select: { email: true } }, items: true }
        });

        const header = 'Order ID,Customer,Email,Phone,Payment,Items,Total,Status,Date';
        const rows = orders.map(o => {
            const itemsStr = o.items.map(i => `${i.name || 'Unknown'} x${i.qty}`).join(' | ');
            return [
                o.id, o.recipientName, o.user?.email || o.guestEmail || '',
                o.recipientPhone, o.paymentMethod, itemsStr,
                o.finalAmount, o.status, new Date(o.createdAt).toISOString().split('T')[0]
            ].map(escapeCSV).join(',');
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
        res.send('﻿' + [header, ...rows].join('\n'));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET /api/admin/users/export?format=csv
exports.exportUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            select: { email: true, name: true, phone: true, rank: true, points: true, totalSpending: true, createdAt: true }
        });

        const header = 'Email,Name,Phone,Rank,Points,Total Spending (VND),Registered';
        const rows = users.map(u => [
            u.email, u.name || '', u.phone || '', u.rank,
            u.points, u.totalSpending, new Date(u.createdAt).toISOString().split('T')[0]
        ].map(escapeCSV).join(','));

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
        res.send('﻿' + [header, ...rows].join('\n'));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// PATCH /api/admin/orders/bulk-status — { ids: [], status: '' }
exports.bulkUpdateOrderStatus = async (req, res) => {
    try {
        const { ids, status } = req.body;
        const allowedStatuses = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Completed', 'Cancelled'];
        if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: 'ids array required' });
        if (!allowedStatuses.includes(status)) return res.status(400).json({ message: 'Invalid status' });

        const { count } = await prisma.order.updateMany({ where: { id: { in: ids } }, data: { status } });

        logger.info('ADMIN_AUDIT', { action: 'bulkUpdateOrderStatus', adminId: req.user?.id, count, status });
        pushAudit('bulkUpdateOrderStatus', { adminId: req.user?.id, count, status });
        res.json({ updated: count });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST /api/admin/users/:id/vouchers — give voucher manually
exports.giveVoucherToUser = async (req, res) => {
    try {
        const { code, discountAmount } = req.body;
        if (!code || discountAmount == null) return res.status(400).json({ message: 'code and discountAmount required' });

        const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true } });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const voucher = await prisma.voucher.create({
            data: { userId: req.params.id, code: code.toUpperCase().trim(), discountAmount: Number(discountAmount), isUsed: false }
        });

        logger.info('ADMIN_AUDIT', { action: 'giveVoucherToUser', adminId: req.user?.id, targetUserId: req.params.id, code: voucher.code });
        pushAudit('giveVoucherToUser', { adminId: req.user?.id, targetUserId: req.params.id, code: voucher.code });
        res.status(201).json(voucher);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Admin delete review
 * DELETE /api/admin/reviews/:id
 */
exports.deleteReview = async (req, res) => {
    try {
        const review = await Review.findByIdAndDelete(req.params.id);
        if (!review) return res.status(404).json({ message: 'Review not found' });

        await recalculateProductRatings(review.productId.toString());

        logger.info('ADMIN_AUDIT', { action: 'deleteReview', adminId: req.user?.id, reviewId: req.params.id, productId: review.productId });
        pushAudit('deleteReview', { adminId: req.user?.id, reviewId: req.params.id, productId: String(review.productId) });
        res.status(200).json({ message: 'Review deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getAuditLogs = (req, res) => {
    res.json(getAuditLogs());
};
