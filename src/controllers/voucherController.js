const Voucher = require('../models/Voucher');
const User = require('../models/User');

/**
 * Get available vouchers (active, in-stock, and not expired)
 */
exports.getAvailableVouchers = async (req, res) => {
    try {
        const now = new Date();
        const vouchers = await Voucher.find({
            isActive: true,
            quantity: { $gt: 0 },
            $or: [
                { expiresAt: null },          // No expiry set
                { expiresAt: { $exists: false } },
                { expiresAt: { $gt: now } }   // Not yet expired
            ]
        });
        res.status(200).json(vouchers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Redeem voucher with points
 */
exports.redeemVoucher = async (req, res) => {
    try {
        const { voucherId } = req.body;
        const user = await User.findById(req.user.id);
        const voucher = await Voucher.findById(voucherId);

        if (!voucher || !voucher.isActive || voucher.quantity <= 0) {
            return res.status(400).json({ message: "Voucher not available" });
        }

        // Check expiry
        if (voucher.expiresAt && new Date() > voucher.expiresAt) {
            return res.status(400).json({ message: "Voucher has expired" });
        }

        if (user.points < voucher.pointsRequired) {
            return res.status(400).json({ message: "Insufficient points" });
        }

        if (user.myVouchers.some(v => v.code === voucher.code)) {
            return res.status(400).json({ message: "Voucher already redeemed" });
        }

        user.points -= voucher.pointsRequired;
        user.myVouchers.push({
            code: voucher.code,
            discountAmount: voucher.discountAmount,
            isUsed: false
        });
        await user.save();

        voucher.quantity -= 1;
        voucher.usageCount = (voucher.usageCount || 0) + 1;
        await voucher.save();

        res.status(200).json({ message: "Voucher redeemed successfully", user });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
