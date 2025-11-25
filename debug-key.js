const API_KEY = "AIzaSyC4sIIqOyP3oc_Tl5naSGw0NFtOPWZG5Sg"; // <-- Thay Key vào đây

async function checkAvailableModels() {
  console.log("🔍 Đang kiểm tra quyền hạn của Key...");
  
  // Gọi trực tiếp API của Google (không qua thư viện) để xem danh sách model
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
      console.log("❌ LỖI TỪ GOOGLE:");
      console.log(JSON.stringify(data.error, null, 2));
    } else if (data.models) {
      console.log("✅ DANH SÁCH MODEL BẠN ĐƯỢC DÙNG:");
      data.models.forEach(m => {
        // Chỉ hiện các model tạo nội dung
        if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")) {
           console.log(`- ${m.name.replace('models/', '')}`);
        }
      });
      
      if (data.models.length === 0) {
          console.log("⚠️ Tài khoản này không thấy model nào cả!");
      }
    } else {
      console.log("⚠️ Phản hồi lạ:", data);
    }
  } catch (error) {
    console.log("❌ Lỗi kết nối mạng:", error.message);
  }
}

checkAvailableModels();