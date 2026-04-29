const mongoose = require('mongoose');
const crypto = require('crypto');

const refreshTokenSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    createdByIp: String
}, { timestamps: true });

// Auto-delete expired tokens (MongoDB TTL index)
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Generate a cryptographically secure refresh token
 * @param {string} userId
 * @param {string} ip - Client IP address
 * @param {number} daysValid - Token validity in days (default 30)
 * @returns {Promise<{doc: Document, rawToken: string}>}
 */
refreshTokenSchema.statics.createToken = async function(userId, ip, daysValid = 30) {
    const rawToken = crypto.randomBytes(40).toString('hex');
    const doc = await this.create({
        userId,
        token: rawToken,
        expiresAt: new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000),
        createdByIp: ip || 'unknown'
    });
    return { doc, rawToken };
};

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
