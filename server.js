// ==================================================================
// ----- 1. IMPORTS & CONFIGURATION -----
// ==================================================================
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require('path');

dotenv.config(); // Đọc biến môi trường từ .env

const app = express();
const PORT = process.env.PORT || 3000;

// Cấu hình CORS và JSON Parser
app.use(cors());
app.use(express.json());

// Cấu hình Static Files (Lưu ý: Trên Render miễn phí, ảnh upload sẽ mất sau khi redeploy)
app.use('/images', express.static(path.join(__dirname, 'images')));

// ==================================================================
// ----- 2. DATABASE CONNECTION -----
// ==================================================================
const mongoUrl = process.env.MONGO_URL;
if (!mongoUrl) {
    console.error("❌ FATAL: MONGO_URL chưa được cấu hình trong .env");
    process.exit(1);
}

mongoose.connect(mongoUrl)
  .then(() => console.log('✅ Database Connected Successfully'))
  .catch((err) => console.error('❌ Database Connection Error:', err));

// ==================================================================
// ----- 3. GEMINI AI SETUP -----
// ==================================================================
const apiKey = process.env.GEMINI_API_KEY;
let model;

if (apiKey) {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Sử dụng model 2.0-flash như bạn đã test thành công
    model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    console.log('✅ Gemini AI Configured');
} else {
    console.warn("⚠️ WARNING: GEMINI_API_KEY thiếu. Chatbot sẽ không hoạt động.");
}

// ==================================================================
// ----- 4. MODELS (SCHEMAS) -----
// ==================================================================

// User Model
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

// Voucher Model
const voucherSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true }, 
    discountAmount: { type: Number, required: true }, 
    pointsRequired: { type: Number, required: true }, 
    quantity: { type: Number, default: 100 }, 
    isActive: { type: Boolean, default: true }
}, { timestamps: true });
const Voucher = mongoose.model('Voucher', voucherSchema);

// Product Model
const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    short_description: String,
    spec: String,
    image_url: String,
    category: String,
    stock: { type: Number, default: 100 }
});
// Index để tìm kiếm nhanh hơn
productSchema.index({ name: 'text', category: 'text' });
const Product = mongoose.model('Product', productSchema);

// Cart Model
const cartSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        name: String,
        quantity: { type: Number, default: 1 },
        price: Number,
        image_url: String
    }]
}, { timestamps: true });
const Cart = mongoose.model('Cart', cartSchema);

// Order Model
const orderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    recipientName: { type: String, required: true },
    recipientPhone: { type: String, required: true },
    recipientAddress: { type: String, required: true },
    recipientNotes: String,
    paymentMethod: { type: String, required: true },
    items: [{
        name: String,
        price: String, // Lưu string định dạng (VD: 30.000.000 đ) để hiển thị
        qty: Number,
        image: String
    }],
    totalAmountString: String,
    totalAmountNumeric: Number, // Giá gốc (chưa trừ voucher)
    finalAmount: Number,        // Giá cuối cùng (sau khi trừ voucher)
    appliedVoucher: { type: String, default: null }, 
    status: { type: String, default: 'Pending' } 
}, { timestamps: true });
const Order = mongoose.model('Order', orderSchema);

// ==================================================================
// ----- 5. MIDDLEWARES -----
// ==================================================================

const verifyToken = (req, res, next) => {
    const authHeader = req.headers.token;
    if (authHeader) {
        const token = authHeader.split(" ")[1];
        jwt.verify(token, process.env.JWT_SECRET, (err, userPayload) => {
            if (err) return res.status(403).json({ message: "Token không hợp lệ!" });
            req.user = userPayload;
            next();
        });
    } else {
        return res.status(401).json({ message: "Bạn chưa đăng nhập!" });
    }
};

const verifyAdmin = (req, res, next) => {
    verifyToken(req, res, () => {
        if (req.user.role === 'admin') {
            next();
        } else {
            res.status(403).json({ message: "Yêu cầu quyền Admin!" });
        }
    });
};

// ==================================================================
// ----- 6. API ROUTES -----
// ==================================================================

app.get('/', (req, res) => res.send('Apple Store API is Running...'));

// ---------------- AUTHENTICATION ----------------
app.post('/api/register', async (req, res) => {
    try {
        const { email, password, username } = req.body;
        if (!email || !password) return res.status(400).json({ message: 'Thiếu thông tin' });
        
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: 'Email đã tồn tại' });
        
        const hashedPassword = await bcrypt.hash(password, 10);
        // Tự động set admin nếu email chứa "admin" (chỉ dùng cho test/demo)
        const role = email.includes('admin') ? 'admin' : 'user';
        
        const newUser = new User({ email, password: hashedPassword, role, rank: 'Silver' });
        await newUser.save();
        res.status(201).json({ message: 'Đăng ký thành công!' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ message: 'Email không đúng' });
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Mật khẩu không đúng' });

        const accessToken = jwt.sign(
            { id: user._id, role: user.role }, 
            process.env.JWT_SECRET,
            { expiresIn: "3d" }
        );
        
        const { password: p, ...userInfo } = user._doc;
        res.status(200).json({ ...userInfo, accessToken });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/api/users/profile', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        const orders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json({ user, orders });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ---------------- PRODUCT & SEARCH ----------------
app.get('/api/products/search', async (req, res) => {
    try {
        const { q, limit } = req.query;
        if (!q) return res.status(200).json({ products: [] });
        
        const products = await Product.find({ 
            name: { $regex: q, $options: 'i' } 
        }).limit(parseInt(limit) || 20);
        
        res.status(200).json({ products });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ---------------- CART MANAGEMENT ----------------
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
            cart = new Cart({ userId: req.user.id, items: [] });
        }
        
        // Kiểm tra xem sản phẩm đã có trong giỏ chưa
        const itemIndex = cart.items.findIndex(p => 
            (p.productId && p.productId.toString() === productId) || p.name === name
        );

        if (itemIndex > -1) {
            cart.items[itemIndex].quantity += quantity;
        } else {
            cart.items.push({ productId, quantity, name, price, image_url });
        }
        
        await cart.save();
        res.status(200).json(cart);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.delete('/api/cart/item/:productId', verifyToken, async (req, res) => {
    try {
        const cart = await Cart.findOne({ userId: req.user.id });
        if (!cart) return res.status(404).json({ message: "Giỏ hàng trống" });
        
        // Lọc bỏ sản phẩm
        cart.items = cart.items.filter(item => 
            item.productId && item.productId.toString() !== req.params.productId
        );
        
        await cart.save();
        res.status(200).json(cart);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

// ---------------- VOUCHER SYSTEM ----------------
app.get('/api/vouchers/available', verifyToken, async (req, res) => {
    try {
        // Chỉ lấy voucher còn active và còn số lượng
        const vouchers = await Voucher.find({ isActive: true, quantity: { $gt: 0 } });
        res.status(200).json(vouchers);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.post('/api/vouchers/redeem', verifyToken, async (req, res) => {
    try {
        const { voucherId } = req.body;
        const user = await User.findById(req.user.id);
        const voucher = await Voucher.findById(voucherId);

        if (!voucher || !voucher.isActive || voucher.quantity <= 0) {
            return res.status(400).json({ message: "Voucher không khả dụng" });
        }
        if (user.points < voucher.pointsRequired) {
            return res.status(400).json({ message: "Bạn không đủ điểm thưởng" });
        }

        // Kiểm tra xem user đã có voucher này chưa
        const alreadyHas = user.myVouchers.some(v => v.code === voucher.code);
        if (alreadyHas) return res.status(400).json({ message: "Bạn đã đổi voucher này rồi" });

        // Trừ điểm và thêm voucher
        user.points -= voucher.pointsRequired;
        user.myVouchers.push({
            code: voucher.code,
            discountAmount: voucher.discountAmount,
            isUsed: false
        });
        await user.save();

        // Trừ số lượng voucher chung
        voucher.quantity -= 1;
        await voucher.save();

        res.status(200).json({ message: "Đổi voucher thành công", user });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

// ---------------- ORDER & CHECKOUT (SECURE) ----------------
app.post('/api/orders', async (req, res) => {
    // Xác thực người dùng thủ công (vì có thể có token hoặc không)
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
        const { recipientName, recipientPhone, recipientAddress, recipientNotes, paymentMethod, items, appliedVoucher } = req.body;

        // --- BƯỚC 1: TÍNH TOÁN LẠI GIÁ (Server-Side Calculation) ---
        let calculatedTotal = 0;
        let secureItems = [];

        for (const item of items) {
            // Tìm sản phẩm trong DB bằng tên (chính xác nhất là dùng ID, nhưng frontend đang gửi name)
            const product = await Product.findOne({ name: item.name });
            
            if (!product) {
                return res.status(400).json({ message: `Sản phẩm "${item.name}" không còn tồn tại.` });
            }
            if (product.stock < item.qty) {
                return res.status(400).json({ message: `Sản phẩm "${item.name}" chỉ còn lại ${product.stock} chiếc.` });
            }

            // Cộng tiền dựa trên giá gốc trong DB
            calculatedTotal += product.price * item.qty;

            // Trừ tồn kho
            product.stock -= item.qty;
            await product.save();

            secureItems.push({
                name: product.name,
                price: product.price.toLocaleString('vi-VN') + ' ₫',
                qty: item.qty,
                image: item.image_url || item.image
            });
        }

        // --- BƯỚC 2: XỬ LÝ VOUCHER ---
        let discountAmount = 0;
        if (appliedVoucher && userId) {
            const user = await User.findById(userId);
            // Tìm voucher trong ví user
            const voucherIndex = user.myVouchers.findIndex(v => v.code === appliedVoucher && !v.isUsed);
            
            if (voucherIndex > -1) {
                discountAmount = user.myVouchers[voucherIndex].discountAmount;
                // Đánh dấu voucher đã dùng
                user.myVouchers[voucherIndex].isUsed = true;
                await user.save();
            }
        }

        // --- BƯỚC 3: TẠO ĐƠN HÀNG ---
        const finalTotal = Math.max(0, calculatedTotal - discountAmount);
        
        const newOrder = new Order({
            userId: userId,
            recipientName, recipientPhone, recipientAddress, recipientNotes,
            paymentMethod,
            items: secureItems, // Dùng items đã được verify giá
            totalAmountString: finalTotal.toLocaleString('vi-VN') + ' ₫',
            totalAmountNumeric: calculatedTotal,
            finalAmount: finalTotal,
            appliedVoucher,
            status: 'Pending'
        });

        const savedOrder = await newOrder.save();

        // --- BƯỚC 4: DỌN DẸP & TÍCH ĐIỂM ---
        if(userId) {
            // Xóa giỏ hàng
            await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });
            
            // Tích điểm (Ví dụ: 100k = 1 điểm)
            const pointsEarned = Math.floor(finalTotal / 100000);
            await User.findByIdAndUpdate(userId, { 
                $inc: { points: pointsEarned, totalSpending: finalTotal } 
            });
            
            // Cập nhật Rank (Logic đơn giản)
            const updatedUser = await User.findById(userId);
            let newRank = updatedUser.rank;
            if (updatedUser.totalSpending > 50000000) newRank = 'VIP';
            else if (updatedUser.totalSpending > 20000000) newRank = 'Gold';
            
            if (newRank !== updatedUser.rank) {
                updatedUser.rank = newRank;
                await updatedUser.save();
            }
        }

        res.status(201).json({ message: 'Đặt hàng thành công!', order: savedOrder });

    } catch (error) {
        console.error("Order Error:", error);
        res.status(500).json({ message: 'Lỗi server: ' + error.message });
    }
});

// ---------------- ADMIN ROUTES ----------------
app.get('/api/admin/orders', verifyAdmin, async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 }).populate('userId', 'email rank');
        res.status(200).json(orders);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.put('/api/admin/orders/:id/status', verifyAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
        res.status(200).json(order);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.get('/api/admin/users', verifyAdmin, async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.status(200).json(users);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.get('/api/admin/vouchers', verifyAdmin, async (req, res) => {
    try {
        const vouchers = await Voucher.find().sort({ createdAt: -1 });
        res.status(200).json(vouchers);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.post('/api/admin/vouchers', verifyAdmin, async (req, res) => {
    try {
        const newVoucher = new Voucher(req.body);
        await newVoucher.save();
        res.status(201).json(newVoucher);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

// ---------------- CHATBOT AI (SMART CONTEXT) ----------------
app.post('/api/chat', verifyToken, async (req, res) => {
    const userMessage = req.body.message;
    const userId = req.user ? req.user.id : null;

    if (!model) return res.status(503).json({ reply: "Hệ thống AI đang bảo trì." });

    try {
        // 1. Chuẩn bị dữ liệu ngữ cảnh
        let contextData = {
            customer: "Khách vãng lai",
            recent_orders: [],
            available_products: []
        };

        if (userId) {
            try {
                const user = await User.findById(userId);
                if (user) {
                    contextData.customer = {
                        name: user.email.split('@')[0],
                        rank: user.rank,
                        points: user.points
                    };
                }
                const orders = await Order.find({ userId }).sort({ createdAt: -1 }).limit(5);
                contextData.recent_orders = orders.map(o => ({
                    id: o._id.toString().slice(-6).toUpperCase(), // Chỉ lấy 6 ký tự cuối cho gọn
                    status: o.status,
                    total: (o.finalAmount || 0).toLocaleString('vi-VN') + 'đ',
                    items: o.items.map(i => i.name).join(", "),
                    date: o.createdAt.toISOString().split('T')[0]
                }));
            } catch (dbError) { console.error("DB Context Error:", dbError); }
        }

        // Lấy danh sách sản phẩm (chỉ lấy tên và giá để tiết kiệm token)
        const products = await Product.find({ stock: { $gt: 0 } }).select('name price category').limit(50);
        contextData.available_products = products.map(p => ({
            name: p.name,
            price: p.price.toLocaleString('vi-VN') + 'đ',
            category: p.category
        }));

        // 2. System Prompt
        const systemPrompt = `
        BẠN LÀ: Trợ lý ảo AI của Apple Store (Backend Admin: Thanh).
        
        DỮ LIỆU HIỆN CÓ:
        - Khách hàng: ${JSON.stringify(contextData.customer)}
        - Đơn hàng gần đây của họ: ${JSON.stringify(contextData.recent_orders)}
        - Sản phẩm đang bán: ${JSON.stringify(contextData.available_products)}

        NHIỆM VỤ:
        1. Trả lời ngắn gọn, thân thiện bằng tiếng Việt.
        2. Nếu khách hỏi giá, HÃY TRA CỨU trong danh sách sản phẩm và trả lời chính xác.
        3. Nếu khách hỏi về đơn hàng, HÃY TRA CỨU trong danh sách đơn hàng gần đây.
        4. Nếu khách hỏi sản phẩm nào dưới X tiền, hãy lọc danh sách và gợi ý.
        5. Đừng bịa đặt thông tin không có trong dữ liệu.

        User hỏi: "${userMessage}"
        `;

        const result = await model.generateContent(systemPrompt);
        const response = await result.response;
        res.json({ reply: response.text() });

    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ reply: "Xin lỗi, AI đang gặp sự cố tạm thời." });
    }
});

// ==================================================================
// ----- 7. SERVER START -----
// ==================================================================
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📡 Deployment Environment: ${process.env.NODE_ENV || 'Development'}`);
});