const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const prisma = require('../config/postgres');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const vnpayService = require('../services/vnpayService');
const dummyProducts = require('../utils/dummyProducts');
const { sendEmail } = require('../services/emailService');
const { buildCancellationEmail, buildOrderConfirmationEmail } = require('../utils/emailTemplates');

/**
 * Finalize a confirmed order: clear cart, award points, update rank.
 * Called immediately for COD; called by IPN handler for VNPay after payment confirmed.
 * Voucher is consumed at order creation to prevent double-use.
 */
async function finalizeSuccessfulOrder(order) {
    const { userId, finalAmount } = order;
    if (!userId) return;

    await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });

    const pointsEarned = Math.floor(finalAmount / 100000);
    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
            points: { increment: pointsEarned },
            totalSpending: { increment: finalAmount }
        }
    });

    let newRank = updatedUser.rank;
    if (updatedUser.totalSpending > 50000000) newRank = 'VIP';
    else if (updatedUser.totalSpending > 20000000) newRank = 'Gold';
    if (newRank !== updatedUser.rank) {
        await prisma.user.update({ where: { id: userId }, data: { rank: newRank } });
    }
}

exports.finalizeSuccessfulOrder = finalizeSuccessfulOrder;

/**
 * Create new order (supports both authenticated and guest users)
 */
exports.createOrder = async (req, res) => {
    const authHeader = req.headers.authorization || req.headers.token;
    let userId = null;
    if (authHeader) {
        try {
            userId = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET).id;
        } catch (e) { /* Guest user */ }
    }

    const {
        recipientName, recipientPhone, recipientAddress, recipientNotes,
        paymentMethod, items, appliedVoucher, guestEmail, createAccount, guestPassword
    } = req.body;

    if (!recipientName || !recipientPhone || !recipientAddress) {
        return res.status(400).json({ message: 'Recipient name, phone, and address are required' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'Order must contain at least one item' });
    }

    // Guests must provide an email for order confirmation
    if (!userId && !guestEmail) {
        return res.status(400).json({ message: 'Email is required for guest checkout' });
    }

    // Guest auto-registration
    if (!userId && createAccount && guestEmail && guestPassword) {
        const existingUser = await prisma.user.findUnique({ where: { email: guestEmail.toLowerCase() } });
        if (!existingUser) {
            const hashedPassword = await bcrypt.hash(guestPassword, 10);
            const newUser = await prisma.user.create({
                data: {
                    email: guestEmail.toLowerCase(),
                    password: hashedPassword,
                    name: recipientName,
                    role: 'user',
                    rank: 'Silver'
                }
            });
            userId = newUser.id;
        }
    }

    let calculatedTotal = 0;
    let secureItems = [];
    let successfullyDeductedItems = [];

    try {
        // 1. DEDUCT STOCK IN MONGODB (atomic per-item)
        for (const item of items) {
            if (!item.productId || !item.qty || item.qty < 1) {
                throw new Error('Each item must have a valid productId and qty >= 1');
            }

            if (mongoose.Types.ObjectId.isValid(item.productId)) {
                const result = await Product.updateOne(
                    { _id: item.productId, stock: { $gte: item.qty } },
                    { $inc: { stock: -item.qty } }
                );
                if (result.modifiedCount === 0) {
                    throw new Error(`Out of stock or invalid product: ${item.productId}`);
                }
                successfullyDeductedItems.push(item);

                const product = await Product.findById(item.productId);
                calculatedTotal += product.price * item.qty;
                secureItems.push({
                    productId: product._id.toString(),
                    name: product.name,
                    price: product.price,
                    qty: item.qty,
                    image: product.image_url || '',
                    color: item.color || null
                });
            } else {
                const dummyProduct = dummyProducts.find(p => p._id === item.productId);
                if (!dummyProduct) throw new Error(`Invalid product ID: ${item.productId}`);
                calculatedTotal += dummyProduct.price * item.qty;
                secureItems.push({
                    productId: dummyProduct._id,
                    name: dummyProduct.name,
                    price: dummyProduct.price,
                    qty: item.qty,
                    image: dummyProduct.image_url || '',
                    color: item.color || null
                });
            }
        }

        // 2. CONSUME VOUCHER at order creation to prevent double-use across multiple orders.
        //    On VNPay failure the IPN handler will restore it.
        let discountAmount = 0;
        let validatedVoucherCode = null;
        if (appliedVoucher && userId) {
            const voucher = await prisma.voucher.findFirst({
                where: { userId, code: appliedVoucher, isUsed: false }
            });
            if (voucher) {
                discountAmount = voucher.discountAmount;
                validatedVoucherCode = voucher.code;
                await prisma.voucher.update({ where: { id: voucher.id }, data: { isUsed: true } });
            }
        }

        const finalTotal = Math.max(0, calculatedTotal - discountAmount);
        const isVNPay = paymentMethod === 'VNPay';

        // 3. CREATE ORDER IN POSTGRESQL
        const savedOrder = await prisma.order.create({
            data: {
                userId,
                recipientName,
                recipientPhone,
                recipientAddress,
                recipientNotes,
                paymentMethod: isVNPay ? 'VNPay' : 'COD',
                subtotal: calculatedTotal,
                discountAmount,
                finalAmount: finalTotal,
                appliedVoucher: validatedVoucherCode || null,
                guestEmail: !userId ? (guestEmail || null) : null,
                // COD is confirmed immediately; VNPay waits for IPN
                status: isVNPay ? 'Pending' : 'Confirmed',
                paymentStatus: 'Pending',
                items: { create: secureItems }
            },
            include: { items: true }
        });

        // 4. POST-ORDER: finalize immediately for COD, defer to IPN for VNPay
        if (!isVNPay) {
            await finalizeSuccessfulOrder(savedOrder);
        }

        let paymentUrl = null;
        if (isVNPay) {
            const returnUrl = process.env.VNPAY_RETURN_URL || 'http://localhost:3000/api/payments/vnpay_return';
            paymentUrl = vnpayService.createPaymentUrl(req, savedOrder.id, finalTotal, returnUrl);
        }

        // Send order confirmation email (fire-and-forget)
        const recipientEmail = userId
            ? (await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }))?.email
            : (guestEmail || null);
        if (recipientEmail) {
            sendEmail({
                to: recipientEmail,
                subject: 'Xác nhận đơn hàng — Apple Store',
                html: buildOrderConfirmationEmail(recipientName, savedOrder)
            }).catch(err => console.error('Order confirmation email failed:', err.message));
        }

        res.status(201).json({
            message: 'Order placed successfully',
            order: savedOrder,
            paymentUrl
        });

    } catch (error) {
        console.error('Order creation failed:', error.message);
        // Compensating transaction: restore MongoDB stock on any failure
        for (const item of successfullyDeductedItems) {
            await Product.updateOne({ _id: item.productId }, { $inc: { stock: item.qty } });
        }
        res.status(400).json({ message: error.message });
    }
};

exports.getOrderById = async (req, res) => {
    try {
        const order = await prisma.order.findUnique({
            where: { id: req.params.id },
            include: { items: true }
        });
        if (!order) {
            return res.status(404).json({ message: 'Order not found. Please check your Order ID.' });
        }
        // If authenticated, verify the order belongs to this user
        if (req.user && order.userId && order.userId !== req.user.id) {
            return res.status(403).json({ message: 'Access denied' });
        }
        res.status(200).json(order);
    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

exports.getUserOrders = async (req, res) => {
    try {
        const orders = await prisma.order.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
            include: { items: true }
        });
        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Cancel an order (user-initiated)
 * PUT /api/orders/:id/cancel
 * Allowed statuses: Pending (VNPay unpaid) or Confirmed (COD)
 */
exports.cancelOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const userId = req.user.id;

        const order = await prisma.order.findUnique({
            where: { id },
            include: { items: true }
        });

        if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
        if (order.userId !== userId) return res.status(403).json({ message: 'Bạn không có quyền hủy đơn hàng này' });

        const cancellableStatuses = ['Pending', 'Confirmed'];
        if (!cancellableStatuses.includes(order.status)) {
            return res.status(400).json({
                message: `Không thể hủy đơn hàng ở trạng thái "${order.status}". Chỉ có thể hủy đơn Pending hoặc Confirmed.`
            });
        }

        const cancelReason = reason?.trim() || 'Khách hàng yêu cầu hủy';
        const originalStatus = order.status;

        await prisma.order.update({
            where: { id },
            data: { status: 'Cancelled', cancelReason }
        });

        // Restore stock in MongoDB
        for (const item of order.items) {
            if (mongoose.Types.ObjectId.isValid(item.productId)) {
                await Product.updateOne({ _id: item.productId }, { $inc: { stock: item.qty } });
            }
        }

        // Restore voucher if one was applied
        if (order.appliedVoucher && order.userId) {
            await prisma.voucher.updateMany({
                where: { userId: order.userId, code: order.appliedVoucher, isUsed: true },
                data: { isUsed: false }
            });
        }

        // Deduct points awarded at finalization (only if COD was confirmed)
        if (originalStatus === 'Confirmed' && order.userId) {
            const pointsEarned = Math.floor(order.finalAmount / 100000);
            if (pointsEarned > 0) {
                const user = await prisma.user.findUnique({
                    where: { id: order.userId },
                    select: { points: true, totalSpending: true }
                });
                await prisma.user.update({
                    where: { id: order.userId },
                    data: {
                        points: Math.max(0, (user?.points || 0) - pointsEarned),
                        totalSpending: Math.max(0, (user?.totalSpending || 0) - order.finalAmount)
                    }
                });
            }
        }

        // Send cancellation email (fire-and-forget)
        if (order.userId) {
            const userRecord = await prisma.user.findUnique({
                where: { id: order.userId },
                select: { email: true, name: true }
            });
            if (userRecord?.email) {
                sendEmail({
                    to: userRecord.email,
                    subject: 'Đơn hàng đã bị hủy — Apple Store',
                    html: buildCancellationEmail(
                        userRecord.name || order.recipientName,
                        { ...order, status: 'Cancelled' },
                        cancelReason
                    )
                }).catch(err => console.error('Cancellation email failed:', err.message));
            }
        }

        res.status(200).json({ message: 'Đơn hàng đã được hủy thành công' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
