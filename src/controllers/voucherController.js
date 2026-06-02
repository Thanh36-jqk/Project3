const Voucher = require('../models/Voucher');
const prisma = require('../config/postgres');

exports.getAvailableVouchers = async (req, res) => {
    try {
        const now = new Date();
        const vouchers = await Voucher.find({
            isActive: true,
            quantity: { $gt: 0 },
            $or: [
                { expiresAt: null },
                { expiresAt: { $exists: false } },
                { expiresAt: { $gt: now } }
            ]
        });
        res.status(200).json(vouchers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.redeemVoucher = async (req, res) => {
    try {
        const { voucherId } = req.body;

        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user) return res.status(404).json({ message: "User not found" });

        const voucher = await Voucher.findById(voucherId);
        if (!voucher || !voucher.isActive || voucher.quantity <= 0) {
            return res.status(400).json({ message: "Voucher not available" });
        }

        if (voucher.expiresAt && new Date() > voucher.expiresAt) {
            return res.status(400).json({ message: "Voucher has expired" });
        }

        if (user.points < voucher.pointsRequired) {
            return res.status(400).json({ message: "Insufficient points" });
        }

        const alreadyRedeemed = await prisma.voucher.findFirst({
            where: { userId: req.user.id, code: voucher.code }
        });
        if (alreadyRedeemed) {
            return res.status(400).json({ message: "Voucher already redeemed" });
        }

        // Atomic MongoDB decrement — prevents overselling under concurrent redemptions
        const claimed = await Voucher.findOneAndUpdate(
            { _id: voucher._id, quantity: { $gt: 0 }, isActive: true },
            { $inc: { quantity: -1, usageCount: 1 } },
            { new: true }
        );
        if (!claimed) {
            return res.status(400).json({ message: "Voucher no longer available" });
        }

        let updatedUser;
        try {
            updatedUser = await prisma.$transaction(async (tx) => {
                const u = await tx.user.update({
                    where: { id: req.user.id },
                    data: { points: { decrement: voucher.pointsRequired } }
                });
                await tx.voucher.create({
                    data: {
                        userId: req.user.id,
                        code: voucher.code,
                        discountAmount: voucher.discountAmount,
                        isUsed: false
                    }
                });
                return u;
            });
        } catch (txError) {
            // Rollback MongoDB decrement if Prisma transaction fails
            await Voucher.updateOne({ _id: voucher._id }, { $inc: { quantity: 1, usageCount: -1 } });
            return res.status(500).json({ message: txError.message });
        }

        res.status(200).json({
            message: "Voucher redeemed successfully",
            points: updatedUser.points,
            voucher: { code: voucher.code, discountAmount: voucher.discountAmount }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
