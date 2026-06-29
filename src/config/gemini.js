const { GoogleGenerativeAI } = require("@google/generative-ai");

let model = null;
let genAI = null;

const initializeGemini = () => {
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
        genAI = new GoogleGenerativeAI(apiKey);
        model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        console.log('✅ Gemini AI Configured (Model: gemini-2.5-flash)');
    } else {
        console.warn("⚠️ WARNING: GEMINI_API_KEY missing. Chatbot will not work.");
    }

    return model;
};

const getModel = () => model;
const getGenAI = () => genAI;

module.exports = { initializeGemini, getModel, getGenAI };
