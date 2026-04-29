const mongoose = require('mongoose');

const voucherSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, uppercase: true },
    discountType: { type: String, enum: ['fixed', 'percentage'], default: 'fixed' },
    discountAmount: { type: Number, required: true },       // VND if fixed, % if percentage
    maxDiscountAmount: Number,                              // Cap for percentage discounts
    minOrderAmount: { type: Number, default: 0 },           // Minimum order value to apply
    pointsRequired: { type: Number, required: true },
    quantity: { type: Number, default: 100 },
    usageCount: { type: Number, default: 0 },               // How many times redeemed
    isActive: { type: Boolean, default: true },
    expiresAt: Date                                         // null = never expires
}, { timestamps: true });

// Index for querying active, non-expired vouchers
voucherSchema.index({ isActive: 1, expiresAt: 1 });

module.exports = mongoose.model('Voucher', voucherSchema);
