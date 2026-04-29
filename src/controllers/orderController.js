const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Cart = require('../models/Cart');
const vnpayService = require('../services/vnpayService');

/**
 * Create new order (supports both authenticated and guest users)
 *
 * SECURITY NOTES:
 * - Price is ALWAYS calculated from DB, never trusted from client.
 * - Stock deduction uses atomic $inc to prevent race conditions (overselling).
 * - All DB operations are wrapped in a MongoDB Transaction for ACID guarantees.
 * - If any step fails, the entire transaction is rolled back.
 */
exports.createOrder = async (req, res) => {
    // Optional authentication — support both logged-in users and guests
    const authHeader = req.headers.authorization || req.headers.token;
    let userId = null;
    if (authHeader) {
        try {
            userId = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET).id;
        } catch (e) { /* Guest user */ }
    }

    // Start MongoDB Transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { recipientName, recipientPhone, recipientAddress, recipientNotes, paymentMethod, items, appliedVoucher, guestEmail, createAccount, guestPassword } = req.body;

        // Validate required fields
        if (!recipientName || !recipientPhone || !recipientAddress) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Recipient name, phone, and address are required' });
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Order must contain at least one item' });
        }

        // Guest auto-registration logic
        if (!userId && createAccount && guestEmail && guestPassword) {
            const existingUser = await User.findOne({ email: guestEmail.toLowerCase() }).session(session);
            if (!existingUser) {
                const hashedPassword = await bcrypt.hash(guestPassword, 10);
                const newUser = new User({
                    email: guestEmail.toLowerCase(),
                    password: hashedPassword,
                    name: recipientName,
                    role: 'user',
                    rank: 'Silver'
                });
                await newUser.save({ session });
                userId = newUser._id;
            } else {
                // If email exists, proceed as guest but don't error out the checkout
                // They can link it later or reset password
            }
        }

        let calculatedTotal = 0;
        let secureItems = [];

        // Process each item — validate existence, check stock, deduct atomically
        for (const item of items) {
            if (!item.productId || !item.qty || item.qty < 1) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ message: 'Each item must have a valid productId and qty >= 1' });
            }

            // Atomic stock deduction: only succeeds if stock >= qty
            // This prevents race conditions where 2 users buy the last item simultaneously
            const result = await Product.updateOne(
                { _id: item.productId, stock: { $gte: item.qty } },
                { $inc: { stock: -item.qty } },
                { session }
            );

            if (result.modifiedCount === 0) {
                await session.abortTransaction();
                session.endSession();
                // Check if product exists to give a better error message
                const product = await Product.findById(item.productId);
                if (!product) {
                    return res.status(404).json({ message: `Product not found: ${item.productId}` });
                }
                return res.status(400).json({
                    message: `Product "${product.name}" has only ${product.stock} units remaining`
                });
            }

            // Fetch product data from DB for order record (NEVER trust client prices)
            const product = await Product.findById(item.productId).session(session);
            calculatedTotal += product.price * item.qty;

            secureItems.push({
                productId: product._id,
                name: product.name,
                price: product.price,
                qty: item.qty,
                image: product.image_url || ''
            });
        }

        // Apply voucher if provided (only for authenticated users)
        let discountAmount = 0;
        if (appliedVoucher && userId) {
            const user = await User.findById(userId).session(session);
            if (user) {
                const voucherIndex = user.myVouchers.findIndex(v => v.code === appliedVoucher && !v.isUsed);
                if (voucherIndex > -1) {
                    discountAmount = user.myVouchers[voucherIndex].discountAmount;
                    user.myVouchers[voucherIndex].isUsed = true;
                    await user.save({ session });
                }
            }
        }

        const finalTotal = Math.max(0, calculatedTotal - discountAmount);

        // Create order with server-calculated values
        const newOrder = new Order({
            userId,
            recipientName,
            recipientPhone,
            recipientAddress,
            recipientNotes,
            paymentMethod: paymentMethod || 'COD',
            items: secureItems,
            subtotal: calculatedTotal,
            discountAmount,
            finalAmount: finalTotal,
            appliedVoucher: appliedVoucher || null,
            guestEmail: req.body.guestEmail || null,
            status: 'Pending'
        });

        const savedOrder = await newOrder.save({ session });

        // Update user data for authenticated users
        if (userId) {
            // Clear user's cart
            await Cart.findOneAndUpdate(
                { userId },
                { $set: { items: [] } },
                { session }
            );

            // Award loyalty points (1 point per 100,000 VND spent)
            const pointsEarned = Math.floor(finalTotal / 100000);
            await User.findByIdAndUpdate(userId, {
                $inc: { points: pointsEarned, totalSpending: finalTotal }
            }, { session });

            // Update user rank based on total spending
            const updatedUser = await User.findById(userId).session(session);
            let newRank = updatedUser.rank;
            if (updatedUser.totalSpending > 50000000) newRank = 'VIP';
            else if (updatedUser.totalSpending > 20000000) newRank = 'Gold';
            if (newRank !== updatedUser.rank) {
                updatedUser.rank = newRank;
                await updatedUser.save({ session });
            }
        }

        // All operations succeeded — commit the transaction
        await session.commitTransaction();
        session.endSession();

        let paymentUrl = null;
        if (paymentMethod === 'VNPay') {
            const returnUrl = process.env.VNPAY_RETURN_URL || 'http://localhost:3000/api/payments/vnpay_return';
            paymentUrl = vnpayService.createPaymentUrl(req, savedOrder._id.toString(), finalTotal, returnUrl);
        }

        res.status(201).json({ 
            message: 'Order placed successfully', 
            order: savedOrder,
            paymentUrl
        });

    } catch (error) {
        // Something failed — rollback everything (stock restored, voucher un-used, etc.)
        await session.abortTransaction();
        session.endSession();
        console.error('Order creation failed:', error.message);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

/**
 * Get order by ID
 */
exports.getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found. Please check your Order ID.' });
        }
        res.status(200).json(order);
    } catch (error) {
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid Order ID format.' });
        }
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

/**
 * Get user's orders (requires authentication)
 */
exports.getUserOrders = async (req, res) => {
    try {
        const orders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
