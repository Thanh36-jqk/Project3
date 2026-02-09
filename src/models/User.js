const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user' },
    rank: { type: String, enum: ['Silver', 'Gold', 'VIP'], default: 'Silver' },
    points: { type: Number, default: 0 },
    totalSpending: { type: Number, default: 0 },
    myVouchers: [{
        code: String,
        discountAmount: Number,
        isUsed: { type: Boolean, default: false },
        redeemedAt: { type: Date, default: Date.now }
    }],
    wishlist: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        addedAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
