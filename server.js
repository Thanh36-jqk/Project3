// ----- REQUIRED LIBRARIES -----
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ----- INITIAL CONFIGURATION -----
dotenv.config(); // Đọc file .env
const app = express();
const PORT = process.env.PORT || 3000;

// ----- GOOGLE AI CONFIGURATION (PROFESSIONAL) -----
// ✅ SỬA LỖI: Lấy Key từ biến môi trường. Không gán cứng key vào code!
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("❌ CRITICAL ERROR: API Key is missing in environment variables!");
    // Không crash app để giữ các tính năng khác, nhưng log lỗi rõ ràng
}

const genAI = new GoogleGenerativeAI(apiKey);

// ✅ KHUYẾN NGHỊ: Dùng 'gemini-1.5-flash' để ổn định và tương thích tốt nhất hiện nay.
// Bản 2.0-flash là bản thử nghiệm (preview), có thể gây lỗi 404/403 với một số Key.
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// ----- MIDDLEWARE -----
app.use(cors());
app.use(express.json());
app.use('/images', express.static('images'));

// ----- MONGODB CONNECTION -----
// Sử dụng biến môi trường cho DB URL luôn để an toàn
const mongoUrl = process.env.MONGO_URL || "mongodb://localhost:27017/my-auth-db";
mongoose.connect(mongoUrl)
  .then(() => {
    console.log('✅ Database Connected');
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('❌ Database Error:', err);
  });

// ==================================================================
// ----- MODEL DEFINITIONS -----
// ==================================================================

// 1. Voucher Model
const voucherSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true }, 
    discountAmount: { type: Number, required: true }, 
    pointsRequired: { type: Number, required: true }, 
    quantity: { type: Number, default: 100 }, 
    isActive: { type: Boolean, default: true }
}, { timestamps: true });
const Voucher = mongoose.model('Voucher', voucherSchema);

// 2. User Model
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, default: 'user' }, 
  rank: { type: String, enum: ['Silver', 'Gold', 'VIP'], default: 'Silver' },
  points: { type: Number, default: 0 }, 
  totalSpending: { type: Number, default: 0 }, 
  myVouchers: [{ 
      code: String,
      discountAmount: Number,
      isUsed: { type: Boolean, default: false },
      redeemedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });
const User = mongoose.model('User', userSchema);

// 3. Product Model
const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    short_description: String,
    spec: String,
    image_url: String,
    category: String,
    stock: { type: Number, default: 100 }
});
productSchema.index({ name: 'text', short_description: 'text', category: 'text' });
const Product = mongoose.model('Product', productSchema);

// 4. Order Model
const orderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    recipientName: { type: String, required: true },
    recipientPhone: { type: String, required: true },
    recipientAddress: { type: String, required: true },
    recipientNotes: { type: String },
    paymentMethod: { type: String, required: true },
    items: [{
        name: String,
        price: String,
        qty: Number,
        image: String
    }],
    totalAmountString: { type: String, required: true },
    totalAmountNumeric: { type: Number, required: true },
    finalAmount: { type: Number }, 
    appliedVoucher: { type: String, default: null }, 
    status: { type: String, default: 'Pending' } 
}, { timestamps: true });
const Order = mongoose.model('Order', orderSchema);

// 5. Cart Model
const cartSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        name: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1, default: 1 },
        price: { type: Number, required: true },
        image_url: { type: String }
    }]
}, { timestamps: true });
const Cart = mongoose.model('Cart', cartSchema);

// ----- MIDDLEWARES -----
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.token;
    if (authHeader) {
        const token = authHeader.split(" ")[1];
        jwt.verify(token, process.env.JWT_SECRET, (err, userPayload) => {
            if (err) return res.status(403).json("Token is not valid!");
            req.user = userPayload;
            next();
        });
    } else {
        return res.status(401).json("You are not authenticated!");
    }
};

const verifyAdmin = (req, res, next) => {
    verifyToken(req, res, () => {
        if (req.user.role === 'admin') {
            next();
        } else {
            res.status(403).json("You are not authorized (Admin access required)!");
        }
    });
};

// ==================================================================
// ----- API ROUTES -----
// ==================================================================

app.get('/', (req, res) => res.send('Server is running...'));

// --- AUTHENTICATION ---
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) return res.status(400).json({ message: 'Missing information' });
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'Email already exists' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword, rank: 'Silver', points: 0 });
    await newUser.save();
    res.status(201).json({ message: 'Registration successful!' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Wrong email' });
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Wrong password' });

    const accessToken = jwt.sign(
        { id: user._id, role: user.role }, 
        process.env.JWT_SECRET,
        { expiresIn: "3d" }
    );
    const { password: p, ...info } = user._doc;
    res.status(200).json({ ...info, accessToken });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// --- CORE APIs (Cart, Orders, Products) ---
// (Giữ nguyên logic nhưng đảm bảo clean code)
app.get('/api/cart', verifyToken, async (req, res) => {
    try {
        const cart = await Cart.findOne({ userId: req.user.id });
        res.status(200).json(cart || { userId: req.user.id, items: [] });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.post('/api/cart/add', verifyToken, async (req, res) => {
    try {
        const { productId, quantity, name, price, image_url } = req.body;
        let cart = await Cart.findOne({ userId: req.user.id });
        if (!cart) {
            cart = new Cart({ userId: req.user.id, items: [{ productId, quantity, name, price, image_url }] });
        } else {
            const itemIndex = cart.items.findIndex(p => p.productId.toString() === productId);
            if (itemIndex > -1) cart.items[itemIndex].quantity += quantity;
            else cart.items.push({ productId, quantity, name, price, image_url });
        }
        await cart.save();
        res.status(200).json(cart);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.delete('/api/cart/item/:productId', verifyToken, async (req, res) => {
    try {
        const cart = await Cart.findOne({ userId: req.user.id });
        if (!cart) return res.status(404).json({ message: "Cart is empty" });
        cart.items = cart.items.filter(item => item.productId.toString() !== req.params.productId);
        await cart.save();
        res.status(200).json(cart);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.get('/api/products/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.status(200).json({ products: [] });
        const products = await Product.find({ name: { $regex: q, $options: 'i' } }).limit(10);
        res.status(200).json({ products });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.post('/api/orders', async (req, res) => {
    const authHeader = req.headers.token; 
    let userId = null;
    if (authHeader) {
        try {
            const token = authHeader.split(" ")[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded.id;
        } catch(e) {}
    }
    try {
        const orderData = { ...req.body, userId: userId, finalAmount: req.body.finalAmount || req.body.totalAmountNumeric };
        const newOrder = new Order(orderData);
        const savedOrder = await newOrder.save();
        if(userId) await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });
        res.status(201).json({ message: 'Success', order: savedOrder });
    } catch (error) { res.status(500).json({ message: 'Failed' }); }
});

app.get('/api/admin/orders', verifyAdmin, async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 }).populate('userId', 'email rank');
        res.status(200).json(orders);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

// --- CHATBOT AI (ROBUST VERSION) ---
// --- CHATBOT AI (ROBUST VERSION - IMPROVED) ---
app.post('/api/chat', verifyToken, async (req, res) => {
    const userMessage = req.body.message;
    const userId = req.user ? req.user.id : null;

    try {
        // 1. CHUẨN BỊ DỮ LIỆU NGỮ CẢNH (CONTEXT)
        let contextData = {
            customer: "Khách vãng lai",
            recent_orders: [],
            available_products: []
        };

        if (userId) {
            try {
                // Lấy thông tin User
                const user = await User.findById(userId);
                if (user) {
                    contextData.customer = {
                        name: user.email.split('@')[0], // Lấy tên từ email cho thân thiện
                        rank: user.rank,
                        points: user.points
                    };
                }
                
                // Lấy lịch sử đơn hàng (KÈM GIÁ TIỀN)
                // Lưu ý: Lấy cả finalAmount để AI biết giá trị đơn
                const orders = await Order.find({ userId }).sort({ createdAt: -1 }).limit(5);
                contextData.recent_orders = orders.map(o => ({
                    id: o._id,
                    status: o.status,
                    total: o.finalAmount || o.totalAmountNumeric, // Ưu tiên lấy giá cuối cùng
                    items: o.items.map(i => i.name).join(", "),
                    date: o.createdAt.toISOString().split('T')[0]
                }));
            } catch (dbError) { console.error("DB Context Error:", dbError); }
        }

        // Lấy danh sách sản phẩm (Tăng giới hạn lên 100 để AI biết nhiều giá hơn)
        // Chỉ lấy tên và giá để tiết kiệm token
        const products = await Product.find({ stock: { $gt: 0 } })
                                      .select('name price category')
                                      .limit(100); 
        
        contextData.available_products = products.map(p => ({
            name: p.name,
            price: p.price,
            category: p.category
        }));

        // 2. CẤU HÌNH "NÃO" CHO AI (SYSTEM PROMPT)
        const systemPrompt = `
        BẠN LÀ: Trợ lý ảo chuyên nghiệp của Apple Store.
        
        NHIỆM VỤ CỦA BẠN:
        1. Trả lời ngắn gọn, súc tích, đi thẳng vào vấn đề. KHÔNG dài dòng văn vở.
        2. KHÔNG lặp lại câu "Với tư cách là khách hàng VIP..." ở mọi tin nhắn. Chỉ nhắc đến ưu đãi khi khách hỏi về giảm giá.
        3. Tư vấn bán hàng: Nếu khách hỏi sản phẩm dưới X tiền, hãy TỰ ĐỘNG lọc danh sách "Available Products" bên dưới và liệt kê ra (kèm giá).
        4. Hỗ trợ đơn hàng: Nếu khách hỏi về đơn hàng, hãy tra cứu trong "Recent Orders".

        DỮ LIỆU HIỆN CÓ (CONTEXT):
        - Khách hàng: ${JSON.stringify(contextData.customer)}
        - Đơn hàng gần đây: ${JSON.stringify(contextData.recent_orders)}
        - Danh sách sản phẩm đang bán (Kèm giá): ${JSON.stringify(contextData.available_products)}

        LƯU Ý QUAN TRỌNG:
        - Đơn vị tiền tệ: VNĐ (Ví dụ: 15.000.000 đ).
        - Nếu khách hỏi giá "iPhone 15 Pro Max", hãy tìm trong danh sách sản phẩm và trả lời con số cụ thể. Nếu không thấy trong danh sách, hãy nói khéo là "hiện đang cập nhật giá".
        - Giọng điệu: Thân thiện, tôn trọng nhưng chuyên nghiệp như nhân viên Apple (Genius Bar).

        CÂU HỎI CỦA KHÁCH: "${userMessage}"
        `;

        // 3. GỌI GEMINI
        const result = await model.generateContent(systemPrompt);
        const response = await result.response;
        
        // Xử lý text trả về (Clean up nếu cần)
        let replyText = response.text();
        
        res.json({ reply: replyText });

    } catch (error) {
        console.error("❌ AI Error:", error);
        res.status(500).json({ reply: "Xin lỗi, hiện tại tôi đang gặp chút trục trặc khi tra cứu dữ liệu. Bạn vui lòng hỏi lại sau nhé!" });
    }
});