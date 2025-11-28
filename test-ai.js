const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI("AIzaSyBRLadR-LavA7ff62IwJ7B_2LzUtIhmaog");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

model.generateContent("Xin chào bằng tiếng Việt")
  .then(r => console.log("✅ SUCCESS:", r.response.text()))
  .catch(e => console.error("❌ ERROR:", e.message));