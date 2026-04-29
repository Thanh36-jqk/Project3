const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    recipientName: { type: String, required: true },
    recipientPhone: { type: String, required: true },
    recipientAddress: { type: String, required: true },
    recipientNotes: String,
    paymentMethod: { type: String, required: true },
    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        name: String,
        price: Number,      // Always stored as integer (VND) — formatting is frontend's job
        qty: Number,
        image: String,
        color: String
    }],
    subtotal: { type: Number, required: true },         // Total before discount
    discountAmount: { type: Number, default: 0 },       // Voucher discount applied
    finalAmount: { type: Number, required: true },      // subtotal - discountAmount
    appliedVoucher: { type: String, default: null },
    status: {
        type: String,
        enum: ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Refunded'],
        default: 'Pending'
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Paid', 'Failed', 'Refunded'],
        default: 'Pending'
    },
    transactionId: { type: String, default: null },
    cancelReason: String,
    guestEmail: String  // For guest checkout — allows order lookup and email notifications
}, { timestamps: true });

// Index for efficient user order lookup
orderSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
