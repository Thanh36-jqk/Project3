const prisma = require('../config/postgres');
const Product = require('../models/Product');
const Voucher = require('../models/Voucher');
const { sendEmail } = require('../services/emailService');

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
        const revenueAgg = await prisma.order.aggregate({ where: { status: 'Completed' }, _sum: { finalAmount: true } });

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
        const allowedStatuses = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Completed', 'Cancelled'];
        if (!status || !allowedStatuses.includes(status)) {
            return res.status(400).json({ message: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` });
        }
        const order = await prisma.order.update({
            where: { id: req.params.id },
            data: { status },
            include: { user: { select: { email: true, name: true } } }
        });

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
        const voucher = await Voucher.findByIdAndDelete(req.params.id);
        if (!voucher) return res.status(404).json({ message: 'Voucher not found' });
        res.status(200).json({ message: 'Voucher deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
