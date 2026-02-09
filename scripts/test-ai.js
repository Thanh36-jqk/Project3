const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI("AIzaSyC4sIIqOyP3oc_Tl5naSGw0NFtOPWZG5Sg");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

model.generateContent("Xin chào bằng tiếng Việt")
  .then(r => console.log("✅ SUCCESS:", r.response.text()))
  .catch(e => console.error("❌ ERROR:", e.message));