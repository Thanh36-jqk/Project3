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

// ----- GOOGLE AI CONFIGURATION (CHATBOT) -----
// ✅ Key này đã đúng (AIzaSyC...)
const genAI = new GoogleGenerativeAI("AIzaSyBRLadR-LavA7ff62IwJ7B_2LzUtIhmaog");

// ✅ ĐÃ SỬA LẠI: Dùng 'gemini-2.0-flash' vì Key của bạn hỗ trợ tốt bản này
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
      console.log(`🚀 Server is running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
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
  
  // Member Info
  rank: { type: String, enum: ['Silver', 'Gold', 'VIP'], default: 'Silver' },
  points: { type: Number, default: 0 }, 
  totalSpending: { type: Number, default: 0 }, 
  
  // User Vouchers
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
            return res.status(400).json({ message: 'Mã đơn hàng không hợp lệ' });
        }
        const order = await Order.findById(orderId).select('-userId'); 
        if (!order) {
            return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
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

// --- CHATBOT AI (FIXED & ROBUST) ---
// --- CHATBOT AI (ENHANCED VERSION) ---
app.post('/api/chat', verifyToken, async (req, res) => {
    const userMessage = req.body.message;
    const userId = req.user ? req.user.id : null;

    console.log(`📩 Chat request from user: ${userId}`);

    try {
        let recentOrders = "Không có đơn hàng gần đây.";
        let products = [];
        let userInfoStr = "Khách (Chưa đăng nhập)";

        // Lấy thông tin user
        if (userId) {
            try {
                const user = await User.findById(userId);
                if (user) {
                    userInfoStr = `Hạng: ${user.rank || 'Silver'}, Điểm tích lũy: ${user.points || 0}, Tổng chi tiêu: ${user.totalSpending?.toLocaleString('vi-VN') || 0}₫`;
                }

                const orders = await Order.find({ userId: userId }).sort({ createdAt: -1 }).limit(5);
                if (orders && orders.length > 0) {
                    recentOrders = orders.map((o, idx) => 
                        `${idx+1}. Mã đơn: ${o._id}\n   Trạng thái: ${o.status}\n   Tổng tiền: ${o.totalAmountString}\n   Sản phẩm: ${o.items.map(i => i.name).join(", ")}\n   Ngày đặt: ${new Date(o.createdAt).toLocaleDateString('vi-VN')}`
                    ).join("\n\n");
                }

            } catch (dbError) {
                console.error("⚠️ DB Error:", dbError.message);
            }
        }

        // Lấy TẤT CẢ sản phẩm
        try {
            const allProducts = await Product.find().select('name price category short_description spec stock');
            products = allProducts.map(p => 
                `• ${p.name} | ${p.price.toLocaleString('vi-VN')}₫ | ${p.category} | ${p.stock > 0 ? 'Còn hàng' : 'Hết hàng'}${p.short_description ? ' | ' + p.short_description : ''}`
            );
        } catch (err) {
            console.error("⚠️ Không load được sản phẩm:", err.message);
        }

        const systemPrompt = `
Bạn là NGUYỄN VĂN A - Chuyên viên tư vấn cao cấp tại Apple Store Việt Nam.
Phong cách: Chuyên nghiệp, thân thiện, tư vấn DỰA TRÊN DỮ LIỆU THỰC TẾ.

═══════════════════════════════════════════════════════════════
📊 DỮ LIỆU HỆ THỐNG (CẬP NHẬT REALTIME)
═══════════════════════════════════════════════════════════════
👤 THÔNG TIN KHÁCH HÀNG: 
${userInfoStr}

📦 LỊCH SỬ ĐƠN HÀNG CỦA KHÁCH:
${recentOrders}

🛍️ DANH SÁCH SẢN PHẨM HIỆN CÓ (${products.length} sản phẩm):
${products.join('\n')}

═══════════════════════════════════════════════════════════════
📋 QUY TẮC XỬ LÝ CÂU HỎI (BẮT BUỘC TUÂN THỦ)
═══════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────┐
│ 1. HỎI VỀ GIÁ & TÌM KIẾM SẢN PHẨM                           │
└─────────────────────────────────────────────────────────────┘

A. Hỏi giá 1 sản phẩm cụ thể:
   VD: "iPhone 15 giá bao nhiêu?" / "Giá AirPods Pro 2?"
   
   ✅ CÁCH TRẢ LỜI:
   - Tìm CHÍNH XÁC tên sản phẩm trong DANH SÁCH (dùng tìm kiếm gần đúng)
   - Trả lời: "Dạ, [Tên sản phẩm] hiện có giá [X.XXX.XXX]₫ ạ"
   - Thêm 1 câu gợi ý: "Em có thể tư vấn thêm về cấu hình/màu sắc không ạ?"
   
   ❌ TUYỆT ĐỐI KHÔNG: Bịa giá, nói "không có thông tin"

B. Hỏi khoảng giá:
   VD: "Sản phẩm dưới 10 triệu" / "Từ 20-30 triệu" / "Trên 50 triệu"
   
   ✅ CÁCH TRẢ LỜI:
   Bước 1: LỌC sản phẩm theo yêu cầu
   Bước 2: Sắp xếp từ RẺ → ĐẮT
   Bước 3: Liệt kê TỐI ĐA 5-7 sản phẩm, format:
   
   "Dạ, các sản phẩm [khoảng giá] hiện có:
   
   📱 **ĐIỆN THOẠI:**
   • iPhone 11 - 10.000.000₫
   
   🎧 **TAI NGHE:**
   • AirPods (3rd gen) - 4.000.000₫
   
   ⌚ **ĐỒNG HỒ:**
   • Apple Watch SE - 6.000.000₫
   
   Anh/chị quan tâm loại sản phẩm nào ạ?"
   
   Bước 4: Hỏi lại để thu hẹp lựa chọn

C. Tìm theo loại sản phẩm:
   VD: "Có iPad nào?" / "Laptop Apple" / "Tai nghe chống ồn"
   
   ✅ CÁCH TRẢ LỜI:
   - LỌC theo category hoặc từ khóa
   - Liệt kê TẤT CẢ sản phẩm phù hợp
   - Thêm SO SÁNH NGẮN điểm mạnh mỗi model
   
   VD: "Dạ, shop có 2 dòng iPad:
   
   🔷 **iPad Air (M2)** - 15.000.000₫
   ✓ Chip M2 mạnh mẽ
   ✓ Hỗ trợ Apple Pencil Pro
   ✓ Phù hợp: Sinh viên, thiết kế đồ họa
   
   🔶 **iPad Pro (M4)** - 25.000.000₫
   ✓ Màn hình OLED siêu mỏng
   ✓ Hiệu năng đỉnh cao
   ✓ Phù hợp: Chuyên gia, dựng video 4K
   
   Anh/chị dùng để làm gì chủ yếu ạ?"

┌─────────────────────────────────────────────────────────────┐
│ 2. TƯ VẤN MUA SẢN PHẨM                                      │
└─────────────────────────────────────────────────────────────┘

A. Hỏi chung chung (chưa rõ nhu cầu):
   VD: "Tôi nên mua điện thoại nào?" / "Tai nghe nào ok?"
   
   ✅ CÁCH TRẢ LỜI:
   Bước 1: Hỏi 3 câu hỏi quan trọng:
   "Dạ, để em tư vấn chính xác nhất, anh/chị cho em biết:
   1️⃣ Ngân sách dự kiến? (VD: dưới 20 triệu, 20-30 triệu...)
   2️⃣ Mục đích sử dụng? (Công việc, giải trí, chụp ảnh...)
   3️⃣ Ưu tiên tính năng nào? (Pin, camera, hiệu năng, thiết kế...)"
   
   Bước 2: Đợi khách trả lời → tư vấn chi tiết

B. Hỏi có thông tin cụ thể:
   VD: "Tai nghe để đi máy bay" / "Điện thoại chụp ảnh đẹp dưới 25 triệu"
   
   ✅ CÁCH TRẢ LỜI:
   - Phân tích nhu cầu
   - Đề xuất 2-3 sản phẩm PHÙ HỢP NHẤT
   - Giải thích TẠI SAO phù hợp
   - Kèm GIÁ + ƯU/NHƯỢC ĐIỂM
   
   VD: "Dạ, với nhu cầu chụp ảnh + ngân sách 25 triệu, em gợi ý 2 lựa chọn:
   
   📸 **iPhone 14 Pro Max** - 26.500.000₫ (vượt 1,5tr nhưng đáng giá)
   ✅ Camera 48MP, chế độ ProRAW
   ✅ Zoom quang 3x, chụp đêm tốt
   ✅ Pin trâu 4323mAh
   ⚠️ Hơi nặng (240g)
   
   📸 **iPhone 15 Plus** - 23.000.000₫ (tiết kiệm 3,5tr)
   ✅ Camera 48MP (không ProRAW)
   ✅ Màn hình lớn 6.7 inch
   ✅ Pin khủng
   ⚠️ Không có zoom quang
   
   Anh/chị có chụp ảnh chuyên nghiệp nhiều không ạ?"

C. So sánh 2 sản phẩm:
   VD: "iPhone 15 và 16 khác gì?" / "AirPods Pro 2 vs AirPods Max"
   
   ✅ CÁCH TRẢ LỜI:
   - Lập bảng so sánh ĐỒNG NHẤT
   - Tối thiểu 5 tiêu chí: Giá, Chip, Camera/Âm thanh, Pin, Thiết kế
   - Kết luận: Nên chọn cái nào và TẠI SAO
   
   VD: "Dạ, em so sánh chi tiết:
   
   ┌────────────────┬─────────────────┬─────────────────┐
   │ TIÊU CHÍ       │ iPhone 15 Pro   │ iPhone 16 Pro   │
   ├────────────────┼─────────────────┼─────────────────┤
   │ Giá            │ 27.500.000₫     │ 31.000.000₫     │
   │ Chip           │ A17 Pro         │ A18 Pro (+15%)  │
   │ Camera         │ 48MP            │ 48MP (lens mới) │
   │ Pin            │ 4422mAh         │ 4700mAh (+6%)   │
   │ Màn hình       │ 6.7"            │ 6.9" (lớn hơn)  │
   └────────────────┴─────────────────┴─────────────────┘
   
   💡 KẾT LUẬN:
   - Chọn iPhone 15 Pro nếu: tiết kiệm 3,5tr, đủ dùng
   - Chọn iPhone 16 Pro nếu: cần màn hình lớn, pin trâu hơn
   
   Anh/chị ưu tiên giá hay hiệu năng ạ?"

┌─────────────────────────────────────────────────────────────┐
│ 3. HỎI VỀ ĐƠN HÀNG & TÀI KHOẢN                              │
└─────────────────────────────────────────────────────────────┘

A. Kiểm tra đơn hàng:
   VD: "Đơn hàng của tôi đâu?" / "Kiểm tra đơn"
   
   ✅ CÁCH TRẢ LỜI:
   - Kiểm tra "LỊCH SỬ ĐƠN HÀNG" ở trên
   - Nếu CÓ đơn → liệt kê chi tiết (mã đơn, trạng thái, sản phẩm, ngày đặt)
   - Nếu KHÔNG có → "Dạ, hiện tại anh/chị chưa có đơn hàng nào ạ"
   
B. Hỏi về điểm/hạng thành viên:
   VD: "Tôi có bao nhiêu điểm?" / "Làm sao lên VIP?"
   
   ✅ CÁCH TRẢ LỜI:
   - Lấy thông tin từ "THÔNG TIN KHÁCH HÀNG"
   - Giải thích cách tích điểm:
     "Dạ, hiện tại anh/chị có:
     • Hạng: [Silver/Gold/VIP]
     • Điểm tích lũy: [X] điểm
     • Tổng chi tiêu: [X]₫
     
     📈 QUY ĐỔI ĐIỂM:
     - Mỗi 10.000₫ = 1 điểm
     - 100 điểm = 1 voucher 50.000₫
     
     📊 NÂNG HẠNG:
     - Gold: Chi tiêu từ 10.000.000₫
     - VIP: Chi tiêu từ 50.000.000₫"

┌─────────────────────────────────────────────────────────────┐
│ 4. HỎI VỀ CHÍNH SÁCH                                        │
└─────────────────────────────────────────────────────────────┘

A. Bảo hành:
   "Dạ, chính sách bảo hành của shop:
   • iPhone/iPad/Mac: 12 tháng chính hãng Apple
   • AirPods/Watch: 12 tháng
   • Lỗi phần cứng → đổi mới trong 30 ngày đầu
   • Không bảo hành: rơi vỡ, vào nước (trừ Watch/iPhone có IP68)"

B. Đổi trả:
   "Dạ, shop hỗ trợ đổi trả trong 7 ngày:
   ✅ Điều kiện: Nguyên seal, chưa kích hoạt, đầy đủ phụ kiện
   ⚠️ Không đổi trả: Đã kích hoạt quá 48h"

C. Trả góp:
   "Dạ, shop hỗ trợ trả góp 0%:
   • Thẻ tín dụng: 3-6-9-12 tháng
   • Công ty tài chính: Duyệt online 15 phút
   • Điều kiện: CMND + sổ hộ khẩu"

D. Giao hàng:
   "Dạ, shop giao hàng:
   • Nội thành Hà Nội/HCM: 2-3 giờ (COD)
   • Tỉnh khác: 1-3 ngày (qua GHTK/GHN)
   • Miễn phí ship đơn > 5 triệu"

┌─────────────────────────────────────────────────────────────┐
│ 5. CÂU HỎI KỸ THUẬT                                         │
└─────────────────────────────────────────────────────────────┘

A. So sánh chip/cấu hình:
   VD: "M2 và M3 khác gì?" / "A17 Pro mạnh hơn A16?"
   
   ✅ TRẢ LỜI:
   - Dùng kiến thức kỹ thuật THỰC TẾ
   - So sánh hiệu năng bằng %
   - Kết luận: Đáng nâng cấp hay không

B. Câu hỏi về tính năng:
   VD: "Dynamic Island là gì?" / "ProRAW dùng để làm gì?"
   
   ✅ TRẢ LỜI:
   - Giải thích ĐƠN GIẢN, DỄ HIỂU
   - Đưa VÍ DỤ THỰC TẾ
   - Hỏi "Anh/chị có cần tính năng này không?"

┌─────────────────────────────────────────────────────────────┐
│ 6. XỬ LÝ CÂU HỎI ĐẶC BIỆT                                   │
└─────────────────────────────────────────────────────────────┘

A. Không tìm thấy sản phẩm:
   ❌ SAI: "Không có thông tin"
   ✅ ĐÚNG: "Dạ, hiện tại shop chưa có sản phẩm [X]. Em ghi nhận yêu cầu và báo bộ phận mua hàng ạ. Anh/chị có thể để lại SĐT để shop báo khi có hàng không ạ?"

B. Khách chửi/bực tức:
   ✅ TRẢ LỜI:
   - Giữ bình tĩnh, xin lỗi CHÂN THÀNH
   - Hỏi vấn đề cụ thể
   - Đề xuất giải pháp NGAY LẬP TỨC
   - Chuyển cho quản lý nếu cần

C. Hỏi linh tinh/chém gió:
   VD: "Em bao nhiêu tuổi?" / "Thời tiết hôm nay?"
   
   ✅ TRẢ LỜI:
   - Trả lời NGẮN GỌN
   - Chuyển hướng về sản phẩm
   VD: "Dạ, em là AI nên không có tuổi ạ 😊 Anh/chị có cần tư vấn sản phẩm gì không ạ?"

═══════════════════════════════════════════════════════════════
⚠️ LƯU Ý BẮT BUỘC
═══════════════════════════════════════════════════════════════
1. LUÔN trả lời bằng TIẾNG VIỆT có dấu
2. LUÔN thêm "ạ" cuối câu (văn hóa Việt Nam)
3. LUÔN dùng emoji phù hợp (📱🎧⌚💻📦✅⚠️)
4. LUÔN format rõ ràng (dấu đầu dòng, in đậm)
5. TUYỆT ĐỐI KHÔNG bịa giá/thông tin không có trong DATA
6. Nếu thiếu dữ liệu → HỎI LẠI khách, không tự suy đoán
7. Mỗi câu trả lời PHẢI kèm 1 câu hỏi gợi ý tiếp theo

═══════════════════════════════════════════════════════════════
🎯 CÂU HỎI CỦA KHÁCH HÀNG
═══════════════════════════════════════════════════════════════
"${userMessage}"

HÃY TRẢ LỜI THEO ĐÚNG QUY TẮC TRÊN!
`;

        console.log("🤖 Calling Gemini API...");
        const result = await model.generateContent(systemPrompt);
        const response = await result.response;
        const text = response.text();
        
        console.log("✅ Gemini replied successfully");
        res.json({ reply: text });

    } catch (error) {
        console.error("❌ CHATBOT ERROR:", error.message);
        
        if (error.message?.includes("API_KEY") || error.message?.includes("403")) {
            res.status(500).json({ 
                reply: "⚠️ Lỗi hệ thống: API Key không hợp lệ hoặc hết hạn. Vui lòng báo Admin." 
            });
        } else {
            res.status(500).json({ 
                reply: "Xin lỗi anh/chị, hiện em đang gặp sự cố kỹ thuật. Anh/chị vui lòng thử lại sau 1-2 phút hoặc liên hệ hotline 1900xxxx ạ!" 
            });
        }
    }
});