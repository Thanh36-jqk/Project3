
const bcrypt = require('bcrypt');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); 
const Product = require('./model/Product');

// ----- KHỞI TẠO ỨNG DỤNG EXPRESS -----
const app = express();

// ----- MIDDLEWARE -----
app.use(express.json()); // Để đọc JSON body
app.use(cors());         // <<< Sử dụng cors middleware - Đã sửa lỗi thiếu

// ----- CẤU HÌNH CỔNG -----
const PORT = 3000;

// ----- KẾT NỐI CƠ SỞ DỮ LIỆU MONGODB -----
const dbURI = 'mongodb://localhost:27017/my-auth-db'; // Đảm bảo chuỗi này đúng

// --- Định nghĩa Schema và Model cho User ---
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// Kết nối đến MongoDB và khởi động server sau khi thành công
mongoose.connect(dbURI)
  .then(() => {
    console.log('Đã kết nối thành công đến MongoDB');
    app.listen(PORT, () => {
      console.log(`Server đang lắng nghe tại http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Lỗi kết nối MongoDB:', err);
    process.exit(1); // Thoát nếu không kết nối được DB
  });

// ----- ĐỊNH NGHĨA ROUTES -----

// Route GET / (Để kiểm tra server chạy)
app.get('/', (req, res) => {
  res.send('Server Express cơ bản đang chạy!');
});

// Route POST /api/register (API Đăng ký)
app.post('/api/register', async (req, res) => {
  console.log('Yêu cầu đến /api/register');
  const { email, password } = req.body;
  console.log('Dữ liệu nhận được:', { email, password: '********' });

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Vui lòng cung cấp email và mật khẩu' });
    }

    const existingUser = await User.findOne({ email: email });
    if (existingUser) {
      console.log(`Email ${email} đã tồn tại.`);
      return res.status(400).json({ message: 'Email đã được đăng ký' });
    }

    console.log(`Email ${email} chưa tồn tại. Đang hash mật khẩu...`);
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    console.log('Đã hash mật khẩu thành công.');

    console.log(`Đang tạo người dùng mới với mật khẩu đã hash...`);
    const newUser = new User({
      email: email,
      password: hashedPassword
    });

    const savedUser = await newUser.save();
    console.log('Đã lưu người dùng mới (với mật khẩu đã hash):', { ...savedUser.toObject(), password: '*** HASHED ***'});

    res.status(201).json({
      message: 'Đăng ký thành công!',
      userId: savedUser._id
    });

  } catch (error) {
    console.error('Lỗi trong quá trình đăng ký:', error);
    res.status(500).json({ message: 'Đã có lỗi xảy ra trên server khi đăng ký' });
  }
}); // <<< KẾT THÚC /api/register

// Route POST /api/login (API Đăng nhập) <<<< Đặt đúng vị trí
app.post('/api/login', async (req, res) => {
  console.log('Yêu cầu đến /api/login');
  const { email, password } = req.body;
  console.log('Dữ liệu nhận được:', { email, password: '********' });

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email: email });
    if (!user) {
      console.log(`Đăng nhập thất bại: Không tìm thấy email ${email}`);
      return res.status(401).json({ message: 'Wrong email or password' });
    }

    console.log(`Tìm thấy người dùng: ${email}. Đang so sánh mật khẩu...`);
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(`Đăng nhập thất bại: Mật khẩu không khớp cho email ${email}`);
      return res.status(401).json({ message: 'Wrong email ' });
    }

    console.log(`Đăng nhập thành công cho email ${email}`);
    // !!! CHỖ NÀY SẼ THAY BẰNG TẠO JWT SAU !!!
    res.status(200).json({
       message: 'Login successful! (No token created yet)',
       userId: user._id
     });

  } catch (error) {
    console.error('Lỗi trong quá trình đăng nhập:', error);
    res.status(500).json({ message: 'Đã có lỗi xảy ra trên server khi đăng nhập' });
  }
}); // <<< KẾT THÚC /api/login

// ----- KẾT THÚC PHẦN ĐỊNH NGHĨA ROUTES -----
// server.js - Thêm đoạn code này vào

// --- IMPORT MODEL SẢN PHẨM ---
// Đảm bảo bạn đã có dòng này ở đầu file server.js



// --- Route GET /api/products/search (API Tìm kiếm Sản phẩm) ---
app.get('/api/products/search', async (req, res) => {
  console.log('Yêu cầu đến /api/products/search');

  // Lấy từ khóa tìm kiếm từ query parameters (req.query.q)
  const searchTerm = req.query.q;
  console.log('Từ khóa tìm kiếm:', searchTerm);

  // Lấy thông tin phân trang từ query parameters (nếu có)
  // parseInt() để đảm bảo giá trị là số nguyên
  const page = parseInt(req.query.page) || 1; // Trang hiện tại, mặc định là 1
  const limit = parseInt(req.query.limit) || 10; // Số lượng kết quả mỗi trang, mặc định 10
  const skip = (page - 1) * limit; // Số lượng bản ghi cần bỏ qua cho trang hiện tại

  // Kiểm tra xem có từ khóa tìm kiếm không
  if (!searchTerm) {
    console.log('Không có từ khóa tìm kiếm. Trả về kết quả rỗng.');
    return res.status(200).json({
        products: [],
        total: 0,
        page: page,
        limit: limit,
        total_pages: 0
    });
  }

  try {
  
    const query = {
      $text: { $search: searchTerm }
    };

    const sort = {
      score: { $meta: "textScore" }
    };

    // Tùy chọn: Chỉ lấy điểm số liên quan trong kết quả
    const projection = {
       score: { $meta: "textScore" }
    };

    // --- Thực hiện truy vấn sản phẩm CÓ PHÂN TRANG ---
    const products = await Product.find(query, projection)
                                  .sort(sort) // Áp dụng sắp xếp theo điểm số
                                  .skip(skip)
                                  .limit(limit)
                                  .exec(); // exec() trả về Promise


    // --- Lấy tổng số kết quả (không áp dụng skip/limit) để tính tổng số trang ---
    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);


    console.log(`Tìm thấy ${totalProducts} sản phẩm cho từ khóa "${searchTerm}" (Trang ${page})`);

    // Trả về kết quả tìm kiếm và thông tin phân trang dưới dạng JSON
    res.status(200).json({
      products: products,
      total: totalProducts,
      page: page,
      limit: limit,
      total_pages: totalPages
    });

  } catch (error) {
    console.error('Lỗi trong quá trình tìm kiếm:', error);
    // Trả về lỗi server
    res.status(500).json({ message: 'An error occurred on the server while searching.', error: error.message });
  }
});

// --- KẾT THÚC PHẦN API Tìm kiếm Sản phẩm ---



// Thêm vào gần đầu file server.js, sau khi import mongoose
const orderSchema = new mongoose.Schema({
    recipientName: { type: String, required: true },
    recipientPhone: { type: String, required: true },
    recipientAddress: { type: String, required: true },
    recipientNotes: { type: String },
    paymentMethod: { type: String, required: true },
    items: [{ // Mảng các sản phẩm trong đơn hàng
        name: String,
        price: String, // Hoặc Number nếu bạn chuẩn hóa giá trị
        qty: Number,
        image: String // Tùy chọn
    }],
    totalAmountString: { type: String, required: true }, // Ví dụ: "50.000 ₫"
    totalAmountNumeric: { type: Number, required: true }, // Ví dụ: 50000
    status: { type: String, default: 'Pending' }, // Trạng thái đơn hàng: Pending, Processing, Shipped, Delivered, Cancelled
    // Bạn có thể thêm userId nếu muốn liên kết đơn hàng với người dùng đã đăng nhập
    // userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true }); // timestamps sẽ tự động thêm createdAt và updatedAt

const Order = mongoose.model('Order', orderSchema);
// ----- Route POST /api/orders (API Tạo Đơn Hàng Mới) -----
// Route POST /api/orders (API Tạo Đơn Hàng Mới)
app.post('/api/orders', async (req, res) => {
    console.log('Yêu cầu đến /api/orders');
    const orderData = req.body;
    console.log('Dữ liệu đơn hàng nhận được:', orderData);

    try {
        // Kiểm tra dữ liệu cơ bản (bạn có thể thêm nhiều kiểm tra hơn)
        if (!orderData.recipientName || !orderData.recipientPhone || !orderData.recipientAddress || !orderData.items || orderData.items.length === 0) {
            return res.status(400).json({ message: 'Please provide complete order information.' });
        }

        const newOrder = new Order({
            recipientName: orderData.recipientName,
            recipientPhone: orderData.recipientPhone,
            recipientAddress: orderData.recipientAddress,
            recipientNotes: orderData.recipientNotes,
            paymentMethod: orderData.paymentMethod,
            items: orderData.items, // items đã là một mảng các object sản phẩm
            totalAmountString: orderData.totalAmountString,
            totalAmountNumeric: orderData.totalAmountNumeric,
            // status sẽ mặc định là 'Pending'
        });

        const savedOrder = await newOrder.save();
        console.log('Đã lưu đơn hàng mới:', savedOrder);

        // Phản hồi thành công cho client
        res.status(201).json({
            message: 'Order!',
            orderId: savedOrder._id,
            orderData: savedOrder // Trả lại toàn bộ thông tin đơn hàng đã lưu
        });

    } catch (error) {
        console.error('Lỗi trong quá trình tạo đơn hàng:', error);
        res.status(500).json({ message: 'An error occurred on the server while creating the order..', error: error.message });
    }
});

app.use('/images', express.static('images'));

// Các route khác của bạn (đăng ký, đăng nhập...) sẽ nằm ở trên hoặc dưới đoạn code này.
// ...
// --- API GET /api/orders/:id (API Lấy thông tin đơn hàng theo ID) ---
app.get('/api/orders/:id', async (req, res) => {
    try {
        const orderId = req.params.id;

        // Kiểm tra xem ID có hợp lệ không
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ message: 'Invalid order code.' });
        }

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ message: 'No order found with this code.' });
        }

        // Nếu tìm thấy, trả về dữ liệu của đơn hàng
        res.status(200).json(order);

    } catch (error) {
        console.error('Error while searching for order:', error);
        res.status(500).json({ message: 'Error while searching for order.' });
    }
});