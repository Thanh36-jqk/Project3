// ----- REQUIRED LIBRARIES -----
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ----- INITIAL CONFIGURATION -----
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// ----- GOOGLE AI CONFIGURATION (FIXED) -----
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// ----- MIDDLEWARE -----
app.use(cors());
app.use(express.json());
app.use('/images', express.static('images'));

// ----- MONGODB CONNECTION -----
mongoose.connect(process.env.MONGO_URL)
  .then(() => {
    console.log('✅ Connected to MongoDB successfully');
    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// ==================================================================
// ----- MODEL DEFINITIONS -----
// ==================================================================

const voucherSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true }, 
    discountAmount: { type: Number, required: true }, 
    pointsRequired: { type: Number, required: true }, 
    quantity: { type: Number, default: 100 }, 
    isActive: { type: Boolean, default: true }
}, { timestamps: true });
const Voucher = mongoose.model('Voucher', voucherSchema);

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

app.get('/', (req, res) => res.send('Express Server is running!'));

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

// --- USER PROFILE ---
app.get('/api/users/profile', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        const orders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json({ user, orders });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// --- SHOPPING CART ---
app.get('/api/cart', verifyToken, async (req, res) => {
    try {
        const cart = await Cart.findOne({ userId: req.user.id });
        res.status(200).json(cart || { userId: req.user.id, items: [] });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/cart/add', verifyToken, async (req, res) => {
    const userId = req.user.id;
    const { productId, quantity, name, price, image_url } = req.body;
    try {
        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, items: [{ productId, quantity, name, price, image_url }] });
        } else {
            const itemIndex = cart.items.findIndex(p => p.productId.toString() === productId);
            if (itemIndex > -1) cart.items[itemIndex].quantity += quantity;
            else cart.items.push({ productId, quantity, name, price, image_url });
        }
        await cart.save();
        res.status(200).json(cart);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.delete('/api/cart/item/:productId', verifyToken, async (req, res) => {
    try {
        const cart = await Cart.findOne({ userId: req.user.id });
        if (!cart) return res.status(404).json({ message: "Cart is empty" });
        cart.items = cart.items.filter(item => item.productId.toString() !== req.params.productId);
        await cart.save();
        res.status(200).json(cart);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// --- PRODUCT SEARCH ---
app.get('/api/products/search', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(200).json({ products: [] });
    try {
        const products = await Product.find({
            name: { $regex: q, $options: 'i' }
        }).limit(10);
        res.status(200).json({ products });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// --- ORDERS ---
app.post('/api/orders', async (req, res) => {
    const authHeader = req.headers.token; 
    let userId = null;
    if (authHeader) {
        try {
            const tokenParts = authHeader.split(" ");
            if (tokenParts.length === 2) {
                const token = tokenParts[1];
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                userId = decoded.id;
            }
        } catch(e) { console.log("Guest checkout"); }
    }

    try {
        const orderData = {
            ...req.body,
            userId: userId,
            finalAmount: req.body.finalAmount || req.body.totalAmountNumeric 
        };
        const newOrder = new Order(orderData);
        const savedOrder = await newOrder.save();
        
        if(userId) {
             await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });
        }

        res.status(201).json({ message: 'Order placed successfully!', order: savedOrder });
    } catch (error) {
        res.status(500).json({ message: 'Failed to place order' });
    }
});

app.get('/api/orders/:id', async (req, res) => {
    try {
        const orderId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ message: 'Invalid order ID' });
        }
        const order = await Order.findById(orderId).select('-userId'); 
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        res.status(200).json(order);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// --- ADMIN APIs ---
app.get('/api/admin/orders', verifyAdmin, async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 }).populate('userId', 'email rank');
        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.put('/api/admin/orders/:id/status', verifyAdmin, async (req, res) => {
    const { status } = req.body;
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Order not found' });

        if (order.status === 'Completed') {
             return res.status(400).json({ message: 'Order is already completed' });
        }

        order.status = status;
        await order.save();

        if (status === 'Completed' && order.userId) {
            const user = await User.findById(order.userId);
            if (user) {
                const amount = order.finalAmount || order.totalAmountNumeric;
                user.totalSpending += amount;
                const pointsEarned = Math.floor(amount / 10000);
                user.points += pointsEarned;

                let newRank = user.rank;
                if (user.totalSpending >= 50000000) newRank = 'VIP';
                else if (user.totalSpending >= 10000000) newRank = 'Gold';
                
                user.rank = newRank;
                await user.save();
            }
        }

        res.json({ message: 'Order status updated', order });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/admin/vouchers', verifyAdmin, async (req, res) => {
    try {
        const newVoucher = new Voucher(req.body);
        await newVoucher.save();
        res.status(201).json(newVoucher);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/api/admin/vouchers', verifyAdmin, async (req, res) => {
    try {
        const vouchers = await Voucher.find().sort({ createdAt: -1 });
        res.status(200).json(vouchers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/api/admin/users', verifyAdmin, async (req, res) => {
    try {
        const users = await User.find().select('-password'); 
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// --- LOYALTY APIs ---
app.get('/api/vouchers/available', verifyToken, async (req, res) => {
    try {
        const vouchers = await Voucher.find({ isActive: true, quantity: { $gt: 0 } });
        res.status(200).json(vouchers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/vouchers/redeem', verifyToken, async (req, res) => {
    const { voucherId } = req.body;
    const userId = req.user.id;

    try {
        const user = await User.findById(userId);
        const voucher = await Voucher.findById(voucherId);

        if (!voucher || !voucher.isActive || voucher.quantity <= 0) {
            return res.status(400).json({ message: "Voucher not available" });
        }

        if (user.points < voucher.pointsRequired) {
            return res.status(400).json({ message: "Not enough points" });
        }

        user.points -= voucher.pointsRequired;
        user.myVouchers.push({
            code: voucher.code,
            discountAmount: voucher.discountAmount,
            isUsed: false
        });
        await user.save();

        voucher.quantity -= 1;
        await voucher.save();

        res.status(200).json({ message: "Redeemed successfully!", remainingPoints: user.points });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// --- CHATBOT AI (PRODUCTION READY) ---
app.post('/api/chat', verifyToken, async (req, res) => {
    const userMessage = req.body.message;
    const userId = req.user ? req.user.id : null;

    console.log(`📩 Chat from user: ${userId}, Message: ${userMessage}`);

    try {
        let recentOrders = "Chưa có đơn hàng";
        let productList = [];
        let userRank = "Silver";
        let userPoints = 0;

        if (userId) {
            try {
                const user = await User.findById(userId);
                if (user) {
                    userRank = user.rank || 'Silver';
                    userPoints = user.points || 0;
                }

                const orders = await Order.find({ userId }).sort({ createdAt: -1 }).limit(3);
                if (orders && orders.length > 0) {
                    recentOrders = orders.map(o => 
                        `${o._id}: ${o.status}, ${o.totalAmountString}`
                    ).join(" | ");
                }
            } catch (e) {
                console.error("DB Error:", e.message);
            }
        }

        try {
            const products = await Product.find().limit(30).select('name price category');
            productList = products.map(p => 
                `${p.name}=${p.price}đ(${p.category})`
            );
        } catch (e) {
            console.error("Product Error:", e.message);
        }

        const systemPrompt = `Bạn là nhân viên Apple Store. Trả lời TIẾNG VIỆT ngắn gọn.

KHÁCH: Hạng ${userRank}, ${userPoints} điểm
ĐƠN GẦN NHẤT: ${recentOrders}
SẢN PHẨM: ${productList.join(', ')}

QUY TẮC:
- Hỏi giá → tìm chính xác trong danh sách
- "Dưới Xtr" → lọc giá<X → liệt kê 3-5 sp
- "Trên Xtr" → lọc giá>X → liệt kê 3-5 sp
- Tư vấn → hỏi ngân sách
- So sánh → làm bảng đơn giản
- KHÔNG bịa giá
- Kết thúc bằng "ạ"

CÂU HỎI: "${userMessage}"`;

        console.log("🤖 Calling Gemini API...");
        const result = await model.generateContent(systemPrompt);
        const text = result.response.text();
        
        console.log("✅ Gemini Success");
        res.json({ reply: text });

    } catch (error) {
        console.error("❌ CHATBOT ERROR:", error.message);
        console.error("Full error:", error);
        
        if (error.message?.includes("API_KEY") || error.message?.includes("403")) {
            return res.status(500).json({ 
                reply: "⚠️ Lỗi API Key. Báo Admin kiểm tra cấu hình." 
            });
        }
        
        if (error.message?.includes("quota") || error.message?.includes("429")) {
            return res.status(500).json({ 
                reply: "⚠️ API đã hết lượt gọi. Thử lại sau 1 giờ ạ!" 
            });
        }

        res.status(500).json({ 
            reply: "Xin lỗi, em đang gặp sự cố kỹ thuật. Thử lại sau 1 phút ạ!" 
        });
    }
});