const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    recipientName: { type: String, required: true },
    recipientPhone: { type: String, required: true },
    recipientAddress: { type: String, required: true },
    recipientNotes: String,
    paymentMethod: { type: String, required: true },
    items: [{
        name: String,
        price: String,
        qty: Number,
        image: String
    }],
    totalAmountString: String,
    totalAmountNumeric: Number,
    finalAmount: Number,
    appliedVoucher: { type: String, default: null },
    status: { type: String, default: 'Pending' }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
