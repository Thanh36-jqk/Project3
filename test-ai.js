const { GoogleGenerativeAI } = require("@google/generative-ai");

// Key của bạn
const genAI = new GoogleGenerativeAI("AIzaSyDnvRXmK4esINe9F8Fki631ZOnIySu6weY"); 

async function runTests() {
  console.log("--- BẮT ĐẦU KIỂM TRA ---");
  
  // Test Model Flash
  try {
    console.log("\n1. Đang thử: gemini-1.5-flash...");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("Xin chào");
    console.log("✅ KẾT QUẢ: " + result.response.text());
  } catch (e) {
    console.log("❌ LỖI FLASH:");
    console.log(e.message); // Hiện toàn bộ thông báo lỗi
  }

  // Test Model Pro
  try {
    console.log("\n2. Đang thử: gemini-pro...");
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent("Xin chào");
    console.log("✅ KẾT QUẢ: " + result.response.text());
  } catch (e) {
    console.log("❌ LỖI PRO:");
    console.log(e.message);
  }
}

runTests();