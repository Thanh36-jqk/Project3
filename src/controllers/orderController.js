const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const prisma = require('../config/postgres');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const vnpayService = require('../services/vnpayService');

/**
 * Create new order (supports both authenticated and guest users)
 */
exports.createOrder = async (req, res) => {
    const authHeader = req.headers.authorization || req.headers.token;
    let userId = null;
    if (authHeader) {
        try {
            userId = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET).id;
        } catch (e) { /* Guest user */ }
    }

    const { recipientName, recipientPhone, recipientAddress, recipientNotes, paymentMethod, items, appliedVoucher, guestEmail, createAccount, guestPassword } = req.body;

    if (!recipientName || !recipientPhone || !recipientAddress) {
        return res.status(400).json({ message: 'Recipient name, phone, and address are required' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'Order must contain at least one item' });
    }

    // Guest auto-registration logic in PostgreSQL
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
        // 1. DEDUCT STOCK IN MONGODB (No global transaction spanning Postgres + Mongo)
        for (const item of items) {
            if (!item.productId || !item.qty || item.qty < 1) {
                throw new Error('Each item must have a valid productId and qty >= 1');
            }

            const result = await Product.updateOne(
                { _id: item.productId, stock: { $gte: item.qty } },
                { $inc: { stock: -item.qty } }
            );

            if (result.modifiedCount === 0) {
                throw new Error(`Product stock deduction failed for ${item.productId}. Out of stock or invalid.`);
            }
            successfullyDeductedItems.push(item);

            const product = await Product.findById(item.productId);
            calculatedTotal += product.price * item.qty;

            secureItems.push({
                productId: product._id.toString(),
                name: product.name,
                price: product.price,
                qty: item.qty,
                image: product.image_url || ''
            });
        }

        // 2. CHECK VOUCHERS IN POSTGRESQL
        let discountAmount = 0;
        if (appliedVoucher && userId) {
            const voucher = await prisma.voucher.findFirst({
                where: { userId, code: appliedVoucher, isUsed: false }
            });
            if (voucher) {
                discountAmount = voucher.discountAmount;
                await prisma.voucher.update({
                    where: { id: voucher.id },
                    data: { isUsed: true }
                });
            }
        }

        const finalTotal = Math.max(0, calculatedTotal - discountAmount);

        // 3. CREATE ORDER IN POSTGRESQL
        const savedOrder = await prisma.order.create({
            data: {
                userId,
                recipientName,
                recipientPhone,
                recipientAddress,
                recipientNotes,
                paymentMethod: paymentMethod || 'COD',
                subtotal: calculatedTotal,
                discountAmount,
                finalAmount: finalTotal,
                appliedVoucher: appliedVoucher || null,
                guestEmail: req.body.guestEmail || null,
                status: 'Pending',
                items: {
                    create: secureItems
                }
            },
            include: { items: true } // Return items in response
        });

        // 4. POST-ORDER UPDATES
        if (userId) {
            await Cart.findOneAndUpdate(
                { userId },
                { $set: { items: [] } }
            );

            const pointsEarned = Math.floor(finalTotal / 100000);
            
            const updatedUser = await prisma.user.update({
                where: { id: userId },
                data: {
                    points: { increment: pointsEarned },
                    totalSpending: { increment: finalTotal }
                }
            });

            let newRank = updatedUser.rank;
            if (updatedUser.totalSpending > 50000000) newRank = 'VIP';
            else if (updatedUser.totalSpending > 20000000) newRank = 'Gold';
            
            if (newRank !== updatedUser.rank) {
                await prisma.user.update({
                    where: { id: userId },
                    data: { rank: newRank }
                });
            }
        }

        let paymentUrl = null;
        if (paymentMethod === 'VNPay') {
            const returnUrl = process.env.VNPAY_RETURN_URL || 'http://localhost:3000/api/payments/vnpay_return';
            paymentUrl = vnpayService.createPaymentUrl(req, savedOrder.id, finalTotal, returnUrl);
        }

        res.status(201).json({ 
            message: 'Order placed successfully', 
            order: savedOrder,
            paymentUrl
        });

    } catch (error) {
        console.error('Order creation failed:', error.message);
        
        // COMPENSATING TRANSACTION: Restore stock in MongoDB if Postgres fails
        for (const item of successfullyDeductedItems) {
            await Product.updateOne(
                { _id: item.productId },
                { $inc: { stock: item.qty } }
            );
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
