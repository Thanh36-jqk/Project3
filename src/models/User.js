const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, default: '' },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String },                     // Optional: Google OAuth users don't have a password
    googleId: { type: String, sparse: true, index: true },  // Google profile ID for OAuth users
    avatar: String,
    phone: String,
    addresses: [{
        label: { type: String, default: 'Home' },   // "Home", "Office", etc.
        fullName: String,
        phone: String,
        address: String,
        isDefault: { type: Boolean, default: false }
    }],
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
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
    }],
    // Email verification & password reset
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: String,
    passwordResetToken: String,
    passwordResetExpires: Date
}, { timestamps: true });


module.exports = mongoose.model('User', userSchema);
