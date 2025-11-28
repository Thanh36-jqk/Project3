const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const mongoUrl = process.env.MONGO_URL;
if (!mongoUrl) {
    console.error("❌ Lỗi: Không tìm thấy MONGO_URL trong file .env");
    process.exit(1);
}

mongoose.connect(mongoUrl)
    .then(() => console.log('✅ Đã kết nối MongoDB...'))
    .catch(err => console.error('❌ Lỗi kết nối:', err));

// Định nghĩa lại Schema Product để script hiểu
const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    short_description: String,
    spec: String,
    image_url: String,
    category: String,
    stock: { type: Number, default: 50 } // Mặc định kho có 50 cái mỗi loại
});
const Product = mongoose.model('Product', productSchema);

// Danh sách sản phẩm chuẩn từ index.html của bạn
const products = [
    // Phone
    { name: 'iPhone 7 Plus', category: 'Phone', price: 22000000, image_url: 'images/iphone7plus.jpeg' },
    { name: 'iPhone 8 Plus', category: 'Phone', price: 5000000, image_url: 'images/iphone8plus.webp' },
    { name: 'iPhone 11', category: 'Phone', price: 10000000, image_url: 'images/iphone11.jpg' },
    { name: 'iPhone SE (3rd gen)', category: 'Phone', price: 10000000, image_url: 'images/iphone se 3rd gold.webp' },
    { name: 'iPhone 12', category: 'Phone', price: 20000000, image_url: 'images/iphone 12 black.png' },
    { name: 'iPhone 12 Pro', category: 'Phone', price: 25000000, image_url: 'images/12 gold.webp' },
    { name: 'iPhone 13', category: 'Phone', price: 15000000, image_url: 'images/iphone 13 blue.jpg' },
    { name: 'iPhone 14', category: 'Phone', price: 17000000, image_url: 'images/iphone 14 red.jpg' },
    { name: 'iPhone 14 Pro Max', category: 'Phone', price: 26500000, image_url: 'images/iphone14promax.webp' },
    { name: 'iPhone 15 Plus', category: 'Phone', price: 23000000, image_url: 'images/iphonee15 plus black.png' },
    { name: 'iPhone 15 Pro Max', category: 'Phone', price: 27500000, image_url: 'images/iphone15promax.webp' },
    { name: 'iPhone 16 Pro Max', category: 'Phone', price: 31000000, image_url: 'images/16 pro max đen.webp' },

    // Headphone
    { name: 'AirPods (3rd gen)', category: 'HeadPhone', price: 4000000, image_url: 'images/AirPods (3rd gen).jpg' },
    { name: 'Airpods Pro 2', category: 'HeadPhone', price: 5000000, image_url: 'images/airpod2.jpg' },
    { name: 'AirPods Max', category: 'HeadPhone', price: 13000000, image_url: 'images/airpodmax.png' },

    // Watch
    { name: 'Apple Watch SE (2nd gen)', category: 'Watch', price: 6000000, image_url: 'images/se black.jpg' },
    { name: 'Apple Watch Series 9', category: 'Watch', price: 10000000, image_url: 'images/watch series 9 rose.webp' },
    { name: 'Apple Watch Ultra 2', category: 'Watch', price: 20000000, image_url: 'images/black.webp' },

    // iPad
    { name: 'iPad Air (M2)', category: 'iPad', price: 15000000, image_url: 'images/ipad air m2 gold.jpg' },
    { name: 'iPad Pro (M4)', category: 'iPad', price: 25000000, image_url: 'images/ipadprom4.jpg' },

    // Laptop
    { name: 'MacBook Air 15 M3', category: 'Laptop', price: 32000000, image_url: 'images/air15 black.webp' },

    // Desktop
    { name: 'iMac 24 M3', category: 'Desktop', price: 33000000, image_url: 'images/imac24.jpg' },
    { name: 'Mac mini M2', category: 'Desktop', price: 15000000, image_url: 'images/Mac mini M2.jpg' },

    // TV & Home
    { name: 'Apple TV 4K (3rd gen)', category: 'TV & Home', price: 3500000, image_url: 'images/appletv4k.jpg' },
    { name: 'HomePod (2nd gen)', category: 'TV & Home', price: 7500000, image: 'images/homepod2.jpg' }
];

const seedDB = async () => {
    try {
        await Product.deleteMany({});
        console.log('🧹 Đã xóa sạch dữ liệu cũ...');

        await Product.insertMany(products);
        console.log(`🎉 Đã nạp thành công ${products.length} sản phẩm vào Database!`);
    } catch (error) {
        console.error('❌ Lỗi:', error);
    } finally {
        mongoose.connection.close();
    }
};

seedDB();