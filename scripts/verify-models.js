const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function testModels() {
    console.log('\n🔍 Testing Gemini Models for Connectivity...\n');

    if (!process.env.GEMINI_API_KEY) {
        console.error('❌ GEMINI_API_KEY missing in .env');
        return;
    }
    console.log(`API Key: ${process.env.GEMINI_API_KEY.substring(0, 8)}...`);

    // List of models to test
    const modelsToTest = [
        "gemini-2.5-flash",    // User's requested (Likely Invalid)
        "gemini-2.0-flash-exp",// Latest V2
        "gemini-1.5-flash",    // Standard V1.5
        "gemini-1.5-pro",      // Pro V1.5
        "gemini-pro"           // Legacy
    ];

    console.log('----------------------------------------');
    for (const modelName of modelsToTest) {
        process.stdout.write(`Testing model: "${modelName}"`.padEnd(30));
        try {
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Hello");
            const response = await result.response;
            console.log(`✅ WORKING!`);
        } catch (error) {
            console.log(`❌ FAILED`);
            // Clean up error message
            let msg = error.message;
            if (msg.includes('404')) msg = 'Model not found (404)';
            else if (msg.includes('API_KEY')) msg = 'Invalid API Key';
            else msg = msg.split('\n')[0].substring(0, 50) + '...';
            console.log(`   Error: ${msg}`);
        }
    }
    console.log('----------------------------------------\n');
}

testModels();
