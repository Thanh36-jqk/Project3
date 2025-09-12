// importProducts.js

const mongoose = require('mongoose');

// --- CẤU HÌNH KẾT NỐI DB ---
// Đảm bảo chuỗi kết nối này giống với trong server.js
const dbURI = 'mongodb://localhost:27017/my-auth-db';

const Product = require('./model/Product'); // Nếu importProducts.js ở thư mục 'model'


// --- DỮ LIỆU SẢN PHẨM CẦN NHẬP ---
// Đây là dữ liệu tôi đã lấy từ các thẻ div.product-item trong index.html của bạn.
// Bạn cần kiểm tra lại và đảm bảo đúng.
// CHÚ Ý: Giá tiền đã được chuyển sang kiểu Number.
const productsToImport = [
  {
    name: "Airpods Pro 2",
    price: 5000000,
    short_description: "Tai nghe không dây chống ồn chủ động, H2 chip",
    spec: "H2 chip, ANC, Bluetooth 5.3, sạc MagSafe",
    image_url: "images/airpod2.jpg",
    category: "HeadPhone"
  },
  {
    name: "Iphone 7 Plus",
    price: 22000000, // Có vẻ giá này hơi cao so với thực tế? Hãy kiểm tra lại nếu cần.
    short_description: "iPhone 7 Plus với camera kép, hiệu năng mượt",
    spec: "Màn hình 5.5in, RAM 3GB, A10 Fusion, Pin 2900mAh",
    image_url: "images/iphone7plus.jpeg",
    category: "Phone"
  },
  {
    name: "Iphone 8 Plus",
    price: 5000000, // Có vẻ giá này hơi thấp so với thực tế? Hãy kiểm tra lại nếu cần.
    short_description: "Thiết kế kính, sạc không dây, hiệu năng ổn định",
    spec: "Màn hình 5.5in Retina HD, A11 Bionic, RAM 3GB, Pin 2691mAh",
    image_url: "images/iphone8plus.webp",
    category: "Phone"
  },
   {
    name: "Iphone 11",
    price: 66000000, // Giá này rất cao, chắc chắn kiểm tra lại ý đồ của bạn.
    short_description: "iPhone 11 với camera kép, pin trâu, màu sắc trẻ trung",
    spec: "Màn hình 6.1in LCD, A13 Bionic, RAM 4GB, Pin 3110mAh",
    image_url: "images/iphone11.jpg",
    category: "Phone"
  },
  {
    name: "Iphone 11 Pro",
    price: 77000000, // Giá này rất cao, chắc chắn kiểm tra lại ý đồ của bạn.
    short_description: "Màn hình OLED, hiệu năng mạnh, camera ba ống kính",
    spec: "Màn hình 5.8in OLED, A13 Bionic, RAM 4GB, 3 camera, Pin 3046mAh",
    image_url: "images/iphone11pro.jpg",
    category: "Phone"
  },
   {
    name: "Iphone 12",
    price: 20000000,
    short_description: "iPhone 12 với màn hình 6.1 inch, chip A14 Bionic",
    spec: "Màn hình: 6.1 inch OLED, Chip: A14 Bionic, RAM: 4GB, Pin: 2815mAh",
    image_url: "images/iphone-12-tim-1-600x600.jpg",
    category: "Phone"
  },
   {
    name: "Iphone 12 Pro",
    price: 25000000,
    short_description: "iPhone 12 Pro với camera Pro, LiDAR",
    spec: "Màn hình: 6.1 inch OLED, Chip: A14 Bionic, RAM: 6GB, Camera: 3 ống kính, Pin: 2815mAh",
    image_url: "images/(600x600)_crop_iphone-12-pro-xtmobile.webp",
    category: "Phone"
  },
  {
    name: "Iphone 14 Pro Max",
    price: 26500000,
    short_description: "Dynamic Island, chip A16 Bionic",
    spec: "Màn hình: 6.7 inch OLED, Chip: A16 Bionic, RAM: 6GB, Camera: 48MP, Pin: 4323mAh",
    image_url: "images/iphone14promax.webp",
    category: "Phone"
  },
  {
    name: "Iphone 15 Pro Max",
    price: 27500000,
    short_description: "Khung titan, chip A17 Pro",
    spec: "Màn hình: 6.7 inch OLED, Chip: A17 Pro, RAM: 8GB, Camera: 48MP, Pin: 4422mAh",
    image_url: "images/iphone15promax.webp",
    category: "Phone"
  },
  {
    name: "Iphone 16 Pro Max",
    price: 31000000,
    short_description: "Màn hình lớn hơn, chip A18 Pro",
    spec: "Màn hình: 6.9 inch OLED, Chip: A18 Pro, RAM: 8GB, Camera: 48MP, Pin: 4700mAh",
    image_url: "images/iphone16promax.jpg",
    category: "Phone"
  },
   {
      name: "MacBook Air 15\" M3",
      price: 32000000,
      short_description: "Màn hình lớn 15 inch, chip M3 mạnh mẽ, thiết kế mỏng nhẹ",
      spec: "M3 8-core CPU, 10-core GPU, 8GB RAM (base), 256GB SSD (base), Màn hình 15.3\", Wi-Fi 6E",
      image_url: "images/mba15-midnight-select-202306.jpg",
      category: "Laptop"
   },
    {
      name: "iMac 24\" M3",
      price: 33000000,
      short_description: "Máy tính All-in-One tuyệt đẹp, chip M3, màn hình Retina 4.5K",
      spec: "M3 8-core CPU, 8/10-core GPU, 8GB RAM (base), 256GB SSD (base), Màn hình 23.5\" 4.5K Retina",
      image_url: "images/imac24.jpg",
      category: "Desktop"
    },
     {
      name: "Mac mini M2",
      price: 15000000,
      short_description: "Desktop nhỏ gọn, hiệu năng ấn tượng với chip M2",
      spec: "M2 8-core CPU, 10-core GPU, 8GB RAM (base), 256GB SSD (base), Wi-Fi 6E, Thunderbolt 4",
      image_url: "images/Mac mini M2.jpg",
      category: "Desktop"
    },
   {
      name: "iPhone SE (3rd gen)",
      price: 10000000,
      short_description: "Hiệu năng mạnh mẽ trong thiết kế nhỏ gọn, chip A15 Bionic",
      spec: "Màn hình 4.7\" Retina HD, A15 Bionic, RAM 4GB, Camera 12MP, Touch ID, 5G",
      image_url: "images/iPhone SE (3rd gen).webp",
      category: "Phone"
   },
   {
      name: "iPhone 13",
      price: 15000000,
      short_description: "Chip A15 Bionic mạnh mẽ, camera kép cải tiến, thời lượng pin tốt",
      spec: "Màn hình 6.1\" Super Retina XDR, A15 Bionic, RAM 4GB, Camera kép 12MP, Pin 3240mAh",
      image_url: "images/iPhone 13.webp",
      category: "Phone"
   },
   {
      name: "iPhone 14",
      price: 17000000,
      short_description: "Phát hiện va chạm, camera nâng cấp, chip A15 Bionic",
      spec: "Màn hình 6.1\" Super Retina XDR, A15 Bionic (5-core GPU), RAM 6GB, Camera kép 12MP, Crash Detection",
      image_url: "images/iPhone 14.webp",
      category: "Phone"
   },
    {
      name: "iPhone 15 Plus",
      price: 23000000,
      short_description: "Màn hình lớn 6.7 inch, Dynamic Island, camera 48MP, USB-C",
      spec: "Màn hình 6.7\" Super Retina XDR, A16 Bionic, RAM 6GB, Camera kép 48MP, Pin lớn, USB-C",
      image_url: "images/iPhone 15 Plus.jpg",
      category: "Phone"
    },
   {
      name: "AirPods (3rd gen)",
      price: 4000000,
      short_description: "Thiết kế mới, Âm thanh không gian, Adaptive EQ",
      spec: "H1 chip, Spatial Audio, Adaptive EQ, IPX4, Thời lượng pin 6 giờ",
      image_url: "images/AirPods (3rd gen).jpg",
      category: "HeadPhone"
   },
   {
      name: "AirPods Max",
      price: 13000000,
      short_description: "Tai nghe over-ear cao cấp, chống ồn chủ động, âm thanh Hi-Fi",
      spec: "H1 chip (mỗi bên), ANC, Transparency Mode, Spatial Audio, Digital Crown",
      image_url: "images/airpodmax.png",
      category: "HeadPhone"
   },
   {
      name: "Apple Watch Series 9",
      price: 10000000,
      short_description: "Chip S9 mạnh mẽ, Double Tap gesture, màn hình sáng hơn",
      spec: "S9 SiP, Double Tap, Màn hình Always-On sáng hơn, ECG, Blood Oxygen, GPS",
      image_url: "images/Apple Watch Series 9.webp",
      category: "Watch"
   },
   {
      name: "Apple Watch Ultra 2",
      price: 20000000,
      short_description: "Bền bỉ nhất, pin lâu nhất, tính năng chuyên nghiệp cho thể thao",
      spec: "S9 SiP, Double Tap, Vỏ Titan, GPS tần số kép, Chống nước 100m, Dive computer",
      image_url: "images/Apple Watch Ultra 2.jpg",
      category: "Watch"
   },
    {
      name: "Apple Watch SE (2nd gen)",
      price: 6000000,
      short_description: "Giá trị tuyệt vời, tính năng thiết yếu, chip S8",
      spec: "S8 SiP, Crash Detection, Theo dõi nhịp tim, Chống nước 50m, Family Setup",
      image_url: "images/AppleWatchSE.jpg",
      category: "Watch"
    },
   {
      name: "iPad Air (M2)",
      price: 15000000,
      short_description: "Chip M2 mạnh mẽ, thiết kế mỏng nhẹ, hỗ trợ Apple Pencil Pro",
      spec: "M2 chip, Màn hình Liquid Retina 11 13\", Camera trước ngang, Touch ID, USB-C",
      image_url: "images/ipadairm2.webp",
      category: "iPad"
   },
   {
      name: "iPad Pro (M4)",
      price: 25000000,
      short_description: "Chip M4 đột phá, màn hình Tandem OLED siêu mỏng, hiệu năng đỉnh cao",
      spec: "M4 chip, Màn hình Ultra Retina XDR (Tandem OLED) 11\\13\", Siêu mỏng, Face ID, USB-C (Thunderbolt)",
      image_url: "images/ipadprom4.jpg",
      category: "iPad"
   },
   {
      name: "Apple TV 4K (3rd gen)",
      price: 3500000,
      short_description: "Giải trí 4K HDR đỉnh cao, chip A15 Bionic, Siri Remote mới",
      spec: "A15 Bionic, 4K Dolby Vision & HDR10+, tvOS, Wi-Fi + Ethernet (model cao cấp), Siri Remote (USB-C)",
      image_url: "images/appletv4k.jpg",
      category: "TV & Nhà"
   },
    {
      name: "HomePod (2nd gen)",
      price: 7500000,
      short_description: "Âm thanh Hi-Fi sống động, tích hợp nhà thông minh, chip S7",
      spec: "S7 chip, Âm thanh không gian, Cảm biến nhiệt độ/độ ẩm, Thread, Matter, Siri",
      image_url: "images/homepod2.jpg",
      category: "TV & Nhà"
    }
];


// --- KẾT NỐI DB VÀ THỰC HIỆN NHẬP DỮ LIỆU ---
mongoose.connect(dbURI)
  .then(async () => {
    console.log('Đã kết nối MongoDB để nhập dữ liệu.');
    try {
      // Tùy chọn: Xóa dữ liệu cũ trước khi nhập lại (nếu chạy script nhiều lần để test)
      // await Product.deleteMany({});
      // console.log('Đã xóa dữ liệu sản phẩm cũ (nếu có).');

      // Chú ý: insertMany sẽ tự động tạo collection 'products' nếu nó chưa tồn tại.
      // Lệnh tạo index trong Schema sẽ được xử lý khi Model được compile và kết nối DB.
      const result = await Product.insertMany(productsToImport);
      console.log(`Đã nhập thành công ${result.length} sản phẩm.`);
    } catch (err) {
      console.error('Lỗi khi nhập dữ liệu:', err);
    } finally {
      mongoose.connection.close(); // Đóng kết nối sau khi xong
      console.log('Đã đóng kết nối MongoDB.');
    }
  })
  .catch((err) => {
    console.error('Lỗi kết nối MongoDB:', err);
  });