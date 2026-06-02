const mongoose = require('mongoose');

/**
 * Initialize MongoDB connection
 * @returns {Promise<void>}
 */
const connectDatabase = async () => {
    const mongoUrl = process.env.MONGO_URL;

    if (!mongoUrl) {
        console.error("❌ MONGO_URL not configured — MongoDB features unavailable");
        return;
    }

    try {
        await mongoose.connect(mongoUrl, { bufferTimeoutMS: 30000, serverSelectionTimeoutMS: 30000 });
        console.log('✅ Database Connected Successfully');
    } catch (err) {
        console.error('❌ Database Connection Error:', err.message);
        // Do not exit — let individual requests fail gracefully (serverless-safe)
    }
};

module.exports = connectDatabase;
