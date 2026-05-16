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

        const updatedUser = await prisma.user.update({
            where: { id: req.user.id },
            data: { points: { decrement: voucher.pointsRequired } }
        });

        await prisma.voucher.create({
            data: {
                userId: req.user.id,
                code: voucher.code,
                discountAmount: voucher.discountAmount,
                isUsed: false
            }
        });

        voucher.quantity -= 1;
        voucher.usageCount = (voucher.usageCount || 0) + 1;
        await voucher.save();

        res.status(200).json({
            message: "Voucher redeemed successfully",
            points: updatedUser.points,
            voucher: { code: voucher.code, discountAmount: voucher.discountAmount }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
