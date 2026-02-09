const { GoogleGenerativeAI } = require("@google/generative-ai");

let model = null;

/**
 * Initialize Gemini AI model
 * @returns {Object|null} Configured Gemini model or null if API key missing
 */
const initializeGemini = () => {
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
        const genAI = new GoogleGenerativeAI(apiKey);
        model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        console.log('✅ Gemini AI Configured (Model: gemini-2.5-flash)');
    } else {
        console.warn("⚠️ WARNING: GEMINI_API_KEY missing. Chatbot will not work.");
    }

    return model;
};

/**
 * Get the initialized Gemini model
 * @returns {Object|null} Gemini model instance
 */
const getModel = () => model;

module.exports = { initializeGemini, getModel };
