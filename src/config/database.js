const mongoose = require('mongoose');

/**
 * Initialize MongoDB connection
 * @returns {Promise<void>}
 */
const connectDatabase = async () => {
    const mongoUrl = process.env.MONGO_URL;

    if (!mongoUrl) {
        console.error("❌ FATAL: MONGO_URL not configured in .env");
        process.exit(1);
    }

    try {
        await mongoose.connect(mongoUrl);
        console.log('✅ Database Connected Successfully');
    } catch (err) {
        console.error('❌ Database Connection Error:', err);
        process.exit(1);
    }
};

module.exports = connectDatabase;
