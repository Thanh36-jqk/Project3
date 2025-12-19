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
// --- [NEW] AUTH IMPORTS (GOOGLE ONLY) ---
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
dotenv.config(); // Đọc biến môi trường từ .env

const app = express();
const PORT = process.env.PORT || 3000;

// Cấu hình CORS và JSON Parser
app.use(cors());
app.use(express.json());
// --- [NEW] SESSION & PASSPORT CONFIG (DEPLOY VERSION) ---
app.set('trust proxy', 1); // Bắt buộc cho Render/Heroku để nhận diện HTTPS

app.use(session({
    secret: 'apple_store_secret_key', // Tốt nhất nên đưa vào .env
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: true, // BẮT BUỘC: true vì web deploy chạy HTTPS
        sameSite: 'none', // Giúp cookie hoạt động tốt giữa Google và Server
        maxAge: 24 * 60 * 60 * 1000 // 1 ngày
    }
}));

app.use(passport.initialize());
app.use(passport.session());

// Hàm định danh User
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) { done(err, null); }
});
// --- [CẬP NHẬT QUAN TRỌNG] CẤU HÌNH STATIC FILES ---
// 1. Phục vụ thư mục ảnh sản phẩm
app.use('/images', express.static(path.join(__dirname, 'images')));

// 2. Phục vụ thư mục 'public' (Nơi chứa 3D Models, Textures cho Landing Page High-End)
app.use('/public', express.static(path.join(__dirname, 'public')));

// 3. Phục vụ thư mục gốc để chạy trực tiếp index.html và store.html
app.use(express.static(__dirname));

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
    model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
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
// ----- [NEW] GOOGLE PASSPORT STRATEGY -----
// ==================================================================
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    // Dùng đường dẫn tuyệt đối của web đã deploy để tránh lỗi
    callbackURL: "https://project3-icy1.onrender.com/auth/google/callback"
},
    async (accessToken, refreshToken, profile, done) => {
        try {
            // Tìm user theo email Google trả về
            let user = await User.findOne({ email: profile.emails[0].value });

            if (!user) {
                // Nếu chưa có, tạo user mới
                console.log("Creating new user via Google...");
                const randomPassword = await bcrypt.hash(Math.random().toString(36), 10);
                user = new User({
                    email: profile.emails[0].value,
                    password: randomPassword,
                    role: 'user',
                    rank: 'Silver',
                    points: 0
                });
                await user.save();
            }
            return done(null, user);
        } catch (err) {
            console.error("Google Auth Error:", err);
            return done(err, null);
        }
    }
));

// --- ROUTES XỬ LÝ ĐĂNG NHẬP GOOGLE ---
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login/login.html' }),
    (req, res) => {
        // Đăng nhập thành công -> Tạo Token
        const accessToken = jwt.sign(
            { id: req.user._id, role: req.user.role },
            process.env.JWT_SECRET,
            { expiresIn: "3d" }
        );

        // Redirect về trang chủ deploy kèm Token
        res.redirect(`https://project3-icy1.onrender.com/?token=${accessToken}`);
    }
);
// ==================================================================
// ----- 6. API ROUTES -----
// ==================================================================

app.get('/', (req, res) => res.send('Apple Store API is Running... Access /store.html to shop.'));

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
        try { userId = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET).id; } catch (e) { }
    }

    try {
        const { recipientName, recipientPhone, recipientAddress, recipientNotes, paymentMethod, items, appliedVoucher } = req.body;
        let calculatedTotal = 0;
        let secureItems = [];

        for (const item of items) {
            const product = await Product.findOne({ name: item.name });
            if (!product) {
                // Nếu không tìm thấy trong DB (có thể do dùng data giả ở frontend), bỏ qua check stock nhưng vẫn tính tiền theo giá gửi lên (hoặc xử lý linh động)
                // Ở môi trường production thực tế, BẮT BUỘC phải check DB.
                // Ở đây ta tạm chấp nhận item từ FE gửi lên nếu không tìm thấy trong DB để demo không bị lỗi.
                secureItems.push({
                    name: item.name,
                    price: item.price, // Dùng giá từ FE gửi lên nếu không có trong DB
                    qty: item.qty,
                    image: item.image_url || item.image
                });
                // Cố gắng parse giá từ string
                const priceNum = parseFloat(String(item.price).replace(/[^\d]/g, ''));
                if (!isNaN(priceNum)) calculatedTotal += priceNum * item.qty;
                continue;
            }

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

        if (userId) {
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

// ---------------- GET ORDER BY ID (For Order Tracking) ----------------
app.get('/api/orders/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found. Please check your Order ID.' });
        }
        res.status(200).json(order);
    } catch (error) {
        // Handle invalid ObjectId format
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid Order ID format.' });
        }
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});


// ---------------- ADMIN ROUTES ----------------
// 1. Lấy danh sách toàn bộ sản phẩm (Kèm tồn kho) - Đưa lên trước verifyAdmin của các route khác để dễ quản lý
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

// ---------------- CHATBOT AI ----------------
// ---------------- CHATBOT AI ----------------
app.post('/api/chat', verifyToken, async (req, res) => {
    console.log('=== CHAT REQUEST RECEIVED ===');
    console.log('User ID:', req.user?.id);
    console.log('Message:', req.body.message);

    const userMessage = req.body.message;
    const userId = req.user ? req.user.id : null;

    // Kiểm tra model
    console.log('Model status:', model ? 'INITIALIZED' : 'NOT INITIALIZED');
    if (!model) {
        console.error('❌ Gemini model not initialized');
        return res.status(503).json({ reply: "Hệ thống AI đang bảo trì." });
    }

    try {
        let contextData = { customer: "Khách vãng lai", recent_orders: [], available_products: [] };

        if (userId) {
            try {
                console.log('📊 Fetching user data...');
                const user = await User.findById(userId);
                if (user) {
                    contextData.customer = {
                        name: user.email.split('@')[0],
                        rank: user.rank,
                        points: user.points
                    };
                    console.log('✅ User data loaded');
                }

                console.log('📊 Fetching orders...');
                const orders = await Order.find({ userId }).sort({ createdAt: -1 }).limit(5);
                contextData.recent_orders = orders.map(o => ({
                    id: o._id.toString().slice(-6).toUpperCase(),
                    status: o.status,
                    total: (o.finalAmount || 0).toLocaleString('vi-VN') + 'đ',
                    items: o.items.map(i => i.name).join(", "),
                    date: o.createdAt.toISOString().split('T')[0]
                }));
                console.log('✅ Orders loaded:', orders.length);
            } catch (dbError) {
                console.error("❌ DB Error:", dbError.message);
            }
        }

        console.log('📊 Fetching products...');
        const products = await Product.find({ stock: { $gt: 0 } }).select('name price category').limit(50);
        contextData.available_products = products.map(p => ({
            name: p.name,
            price: p.price.toLocaleString('vi-VN') + 'đ',
            category: p.category
        }));
        console.log('✅ Products loaded:', products.length);

        const systemPrompt = `
        BẠN LÀ: Trợ lý ảo AI của Apple Store.
        DỮ LIỆU:
        - Khách: ${JSON.stringify(contextData.customer)}
        - Đơn hàng gần đây: ${JSON.stringify(contextData.recent_orders)}
        - Sản phẩm: ${JSON.stringify(contextData.available_products)}
        NHIỆM VỤ: Trả lời ngắn gọn, chính xác về giá và đơn hàng.
        User hỏi: "${userMessage}"
        `;

        console.log('🤖 Calling Gemini API...');
        console.log('Prompt length:', systemPrompt.length);

        const result = await model.generateContent(systemPrompt);
        console.log('✅ Gemini API responded');

        const response = await result.response;
        const replyText = response.text();
        console.log('✅ Reply length:', replyText.length);

        if (!replyText) {
            return res.json({ reply: "I'm sorry, I couldn't generate a response." });
        }

        res.json({ reply: replyText });

    } catch (error) {
        console.error('❌ CHAT ERROR - FULL DETAILS:');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);

        // Log thêm chi tiết nếu có
        if (error.response) {
            console.error('Error response:', JSON.stringify(error.response));
        }
        if (error.status) {
            console.error('Error status:', error.status);
        }

        res.status(500).json({
            reply: "Xin lỗi, AI đang gặp sự cố.",
            // Chỉ show error trong development
            ...(process.env.NODE_ENV !== 'production' && {
                error: error.message
            })
        });
    }
});
// ==================================================================
// ----- 7. SERVER START -----
// ==================================================================
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📡 Deployment Environment: ${process.env.NODE_ENV || 'Development'}`);
    console.log(`📂 Static files served from: ${__dirname} and ${path.join(__dirname, 'public')}`);
});