const jwt = require('jsonwebtoken');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Cart = require('../models/Cart');

/**
 * Create new order (supports both authenticated and guest users)
 */
exports.createOrder = async (req, res) => {
    const authHeader = req.headers.token;
    let userId = null;
    if (authHeader) {
        try {
            userId = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET).id;
        } catch (e) { }
    }

    try {
        const { recipientName, recipientPhone, recipientAddress, recipientNotes, paymentMethod, items, appliedVoucher } = req.body;
        let calculatedTotal = 0;
        let secureItems = [];

        // Process each item and validate stock
        for (const item of items) {
            const product = await Product.findOne({ name: item.name });
            if (!product) {
                // Fallback for products not in DB (demo purposes)
                secureItems.push({
                    name: item.name,
                    price: item.price,
                    qty: item.qty,
                    image: item.image_url || item.image
                });
                const priceNum = parseFloat(String(item.price).replace(/[^\d]/g, ''));
                if (!isNaN(priceNum)) calculatedTotal += priceNum * item.qty;
                continue;
            }

            if (product.stock < item.qty) {
                return res.status(400).json({
                    message: `Product "${item.name}" has only ${product.stock} units remaining`
                });
            }

            calculatedTotal += product.price * item.qty;
            product.stock -= item.qty;
            await product.save();

            secureItems.push({
                name: product.name,
                price: product.price.toLocaleString('vi-VN') + ' ₫',
                qty: item.qty,
                image: item.image_url || item.image
            });
        }

        // Apply voucher if provided
        let discountAmount = 0;
        if (appliedVoucher && userId) {
            const user = await User.findById(userId);
            const voucherIndex = user.myVouchers.findIndex(v => v.code === appliedVoucher && !v.isUsed);
            if (voucherIndex > -1) {
                discountAmount = user.myVouchers[voucherIndex].discountAmount;
                user.myVouchers[voucherIndex].isUsed = true;
                await user.save();
            }
        }

        const finalTotal = Math.max(0, calculatedTotal - discountAmount);
        const newOrder = new Order({
            userId,
            recipientName,
            recipientPhone,
            recipientAddress,
            recipientNotes,
            paymentMethod,
            items: secureItems,
            totalAmountString: finalTotal.toLocaleString('vi-VN') + ' ₫',
            totalAmountNumeric: calculatedTotal,
            finalAmount: finalTotal,
            appliedVoucher,
            status: 'Pending'
        });

        const savedOrder = await newOrder.save();

        // Update user data for authenticated users
        if (userId) {
            await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });
            const pointsEarned = Math.floor(finalTotal / 100000);
            await User.findByIdAndUpdate(userId, {
                $inc: { points: pointsEarned, totalSpending: finalTotal }
            });

            // Update user rank based on total spending
            const updatedUser = await User.findById(userId);
            let newRank = updatedUser.rank;
            if (updatedUser.totalSpending > 50000000) newRank = 'VIP';
            else if (updatedUser.totalSpending > 20000000) newRank = 'Gold';
            if (newRank !== updatedUser.rank) {
                updatedUser.rank = newRank;
                await updatedUser.save();
            }
        }

        res.status(201).json({ message: 'Order placed successfully', order: savedOrder });
    } catch (error) {
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
