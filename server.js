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

// Cấu hình Static Files
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
    model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    console.log('✅ Gemini AI Configured');
} else {
    console.warn("⚠️ WARNING: GEMINI_API_KEY thiếu. Chatbot sẽ không hoạt động.");
}

// ==================================================================
// ----- 4. MODELS (SCHEMAS) -----
// ==================================================================

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user' }, 
    rank: { type: String, enum: ['Silver', 'Gold', 'VIP'], default: 'Silver' },
    points: { type: Number, default: 0 }, 
    totalSpending: { type: Number, default: 0 }, 
    myVouchers: [{ 
        code: String, discountAmount: Number, isUsed: { type: Boolean, default: false }, redeemedAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });
const User = mongoose.model('User', userSchema);

const voucherSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true }, 
    discountAmount: { type: Number, required: true }, 
    pointsRequired: { type: Number, required: true }, 
    quantity: { type: Number, default: 100 }, 
    isActive: { type: Boolean, default: true }
}, { timestamps: true });
const Voucher = mongoose.model('Voucher', voucherSchema);

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    short_description: String,
    spec: String,
    image_url: String,
    category: String,
    stock: { type: Number, default: 100 }
});
productSchema.index({ name: 'text', category: 'text' });
const Product = mongoose.model('Product', productSchema);

const cartSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        name: String, quantity: { type: Number, default: 1 }, price: Number, image_url: String
    }]
}, { timestamps: true });
const Cart = mongoose.model('Cart', cartSchema);

const orderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    recipientName: { type: String, required: true },
    recipientPhone: { type: String, required: true },
    recipientAddress: { type: String, required: true },
    recipientNotes: String,
    paymentMethod: { type: String, required: true },
    items: [{ name: String, price: String, qty: Number, image: String }],
    totalAmountString: String,
    totalAmountNumeric: Number,
    finalAmount: Number,
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
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: 'Thiếu thông tin' });
        
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: 'Email đã tồn tại' });
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const role = email.includes('admin') ? 'admin' : 'user';
        
        const newUser = new User({ email, password: hashedPassword, role, rank: 'Silver' });
        await newUser.save();
        res.status(201).json({ message: 'Đăng ký thành công!' });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ message: 'Email không đúng' });
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Mật khẩu không đúng' });

        const accessToken = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "3d" });
        const { password: p, ...userInfo } = user._doc;
        res.status(200).json({ ...userInfo, accessToken });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.get('/api/users/profile', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        const orders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json({ user, orders });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

// ---------------- PRODUCT & SEARCH ----------------
app.get('/api/products/search', async (req, res) => {
    try {
        const { q, limit } = req.query;
        if (!q) return res.status(200).json({ products: [] });
        const products = await Product.find({ name: { $regex: q, $options: 'i' } }).limit(parseInt(limit) || 20);
        res.status(200).json({ products });
    } catch (error) { res.status(500).json({ message: error.message }); }
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
        if (!cart) cart = new Cart({ userId: req.user.id, items: [] });
        
        const itemIndex = cart.items.findIndex(p => (p.productId && p.productId.toString() === productId) || p.name === name);
        if (itemIndex > -1) cart.items[itemIndex].quantity += quantity;
        else cart.items.push({ productId, quantity, name, price, image_url });
        
        await cart.save();
        res.status(200).json(cart);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.delete('/api/cart/item/:productId', verifyToken, async (req, res) => {
    try {
        const cart = await Cart.findOne({ userId: req.user.id });
        if (!cart) return res.status(404).json({ message: "Giỏ hàng trống" });
        cart.items = cart.items.filter(item => item.productId && item.productId.toString() !== req.params.productId);
        await cart.save();
        res.status(200).json(cart);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

// ---------------- VOUCHER SYSTEM ----------------
app.get('/api/vouchers/available', verifyToken, async (req, res) => {
    try {
        const vouchers = await Voucher.find({ isActive: true, quantity: { $gt: 0 } });
        res.status(200).json(vouchers);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.post('/api/vouchers/redeem', verifyToken, async (req, res) => {
    try {
        const { voucherId } = req.body;
        const user = await User.findById(req.user.id);
        const voucher = await Voucher.findById(voucherId);

        if (!voucher || !voucher.isActive || voucher.quantity <= 0) return res.status(400).json({ message: "Voucher không khả dụng" });
        if (user.points < voucher.pointsRequired) return res.status(400).json({ message: "Bạn không đủ điểm thưởng" });
        if (user.myVouchers.some(v => v.code === voucher.code)) return res.status(400).json({ message: "Bạn đã đổi voucher này rồi" });

        user.points -= voucher.pointsRequired;
        user.myVouchers.push({ code: voucher.code, discountAmount: voucher.discountAmount, isUsed: false });
        await user.save();

        voucher.quantity -= 1;
        await voucher.save();

        res.status(200).json({ message: "Đổi voucher thành công", user });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

// ---------------- ORDER & CHECKOUT (SECURE) ----------------
app.post('/api/orders', async (req, res) => {
    const authHeader = req.headers.token; 
    let userId = null;
    if (authHeader) {
        try { userId = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET).id; } catch(e) {}
    }

    try {
        const { recipientName, recipientPhone, recipientAddress, recipientNotes, paymentMethod, items, appliedVoucher } = req.body;
        let calculatedTotal = 0;
        let secureItems = [];

        for (const item of items) {
            const product = await Product.findOne({ name: item.name });
            if (!product) return res.status(400).json({ message: `Sản phẩm "${item.name}" không còn tồn tại.` });
            if (product.stock < item.qty) return res.status(400).json({ message: `Sản phẩm "${item.name}" chỉ còn lại ${product.stock} chiếc.` });

            calculatedTotal += product.price * item.qty;
            product.stock -= item.qty;
            await product.save();

            secureItems.push({
                name: product.name,
                price: product.price.toLocaleString('vi-VN') + ' ₫',
                qty: item.qty,
                image: item.image_url || item.image
            });
        }

        let discountAmount = 0;
        if (appliedVoucher && userId) {
            const user = await User.findById(userId);
            const voucherIndex = user.myVouchers.findIndex(v => v.code === appliedVoucher && !v.isUsed);
            if (voucherIndex > -1) {
                discountAmount = user.myVouchers[voucherIndex].discountAmount;
                user.myVouchers[voucherIndex].isUsed = true;
                await user.save();
            }
        }

        const finalTotal = Math.max(0, calculatedTotal - discountAmount);
        const newOrder = new Order({
            userId, recipientName, recipientPhone, recipientAddress, recipientNotes, paymentMethod,
            items: secureItems,
            totalAmountString: finalTotal.toLocaleString('vi-VN') + ' ₫',
            totalAmountNumeric: calculatedTotal,
            finalAmount: finalTotal,
            appliedVoucher,
            status: 'Pending'
        });

        const savedOrder = await newOrder.save();

        if(userId) {
            await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });
            const pointsEarned = Math.floor(finalTotal / 100000);
            await User.findByIdAndUpdate(userId, { $inc: { points: pointsEarned, totalSpending: finalTotal } });
            
            const updatedUser = await User.findById(userId);
            let newRank = updatedUser.rank;
            if (updatedUser.totalSpending > 50000000) newRank = 'VIP';
            else if (updatedUser.totalSpending > 20000000) newRank = 'Gold';
            if (newRank !== updatedUser.rank) { updatedUser.rank = newRank; await updatedUser.save(); }
        }

        res.status(201).json({ message: 'Đặt hàng thành công!', order: savedOrder });
    } catch (error) { res.status(500).json({ message: 'Lỗi server: ' + error.message }); }
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

// --- [FIX] ĐƯA CODE QUẢN LÝ KHO HÀNG LÊN TRƯỚC SERVER START ---

// 1. Lấy danh sách toàn bộ sản phẩm (Kèm tồn kho)
app.get('/api/admin/products', verifyAdmin, async (req, res) => {
    try {
        const products = await Product.find().sort({ name: 1 });
        res.status(200).json(products);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

// 2. Cập nhật số lượng tồn kho (Nhập/Xả hàng)
app.put('/api/admin/products/:id/stock', verifyAdmin, async (req, res) => {
    try {
        const { newStock } = req.body; 
        if (newStock < 0) return res.status(400).json({ message: "Tồn kho không thể âm" });

        const product = await Product.findByIdAndUpdate(req.params.id, { stock: newStock }, { new: true });
        res.status(200).json({ message: "Cập nhật kho thành công", product });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

// ---------------- CHATBOT AI ----------------
app.post('/api/chat', verifyToken, async (req, res) => {
    const userMessage = req.body.message;
    const userId = req.user ? req.user.id : null;

    if (!model) return res.status(503).json({ reply: "Hệ thống AI đang bảo trì." });

    try {
        let contextData = { customer: "Khách vãng lai", recent_orders: [], available_products: [] };

        if (userId) {
            try {
                const user = await User.findById(userId);
                if (user) contextData.customer = { name: user.email.split('@')[0], rank: user.rank, points: user.points };
                
                const orders = await Order.find({ userId }).sort({ createdAt: -1 }).limit(5);
                contextData.recent_orders = orders.map(o => ({
                    id: o._id.toString().slice(-6).toUpperCase(),
                    status: o.status,
                    total: (o.finalAmount || 0).toLocaleString('vi-VN') + 'đ',
                    items: o.items.map(i => i.name).join(", "),
                    date: o.createdAt.toISOString().split('T')[0]
                }));
            } catch (dbError) { console.error("DB Context Error:", dbError); }
        }

        const products = await Product.find({ stock: { $gt: 0 } }).select('name price category').limit(50);
        contextData.available_products = products.map(p => ({
            name: p.name, price: p.price.toLocaleString('vi-VN') + 'đ', category: p.category
        }));

        const systemPrompt = `
        BẠN LÀ: Trợ lý ảo AI của Apple Store.
        DỮ LIỆU:
        - Khách: ${JSON.stringify(contextData.customer)}
        - Đơn hàng gần đây: ${JSON.stringify(contextData.recent_orders)}
        - Sản phẩm: ${JSON.stringify(contextData.available_products)}
        NHIỆM VỤ: Trả lời ngắn gọn, chính xác về giá và đơn hàng.
        User hỏi: "${userMessage}"
        `;

        const result = await model.generateContent(systemPrompt);
        const response = await result.response;
        res.json({ reply: response.text() });
    } catch (error) { res.status(500).json({ reply: "Xin lỗi, AI đang gặp sự cố." }); }
});

// ==================================================================
// ----- 7. SERVER START -----
// ==================================================================
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📡 Deployment Environment: ${process.env.NODE_ENV || 'Development'}`);
});