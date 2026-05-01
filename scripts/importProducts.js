// importProducts.js

require('dotenv').config();
const mongoose = require('mongoose');

// --- CẤU HÌNH KẾT NỐI DB ---
// Lấy chuỗi kết nối từ file .env (Cloud MongoDB)
const dbURI = process.env.MONGO_URL || 'mongodb://localhost:27017/my-auth-db';

const Product = require('../src/models/Product'); // Sửa lại đường dẫn import đúng model


// --- PRODUCT DATA TO IMPORT ---
// Data extracted from your index.html product items.
// Please verify for accuracy.
// NOTE: Prices converted to Number type.
const productsToImport = [
  {
    name: "Airpods Pro 2",
    price: 5000000,
    short_description: "Active Noise Cancelling wireless earbuds, H2 chip",
    spec: "H2 chip, ANC, Bluetooth 5.3, MagSafe charging",
    image_url: "images/airpod2.jpg",
    category: "HeadPhone"
  },
  {
    name: "Iphone 7 Plus",
    price: 22000000,
    short_description: "iPhone 7 Plus with dual cameras, smooth performance",
    spec: "5.5in screen, 3GB RAM, A10 Fusion, 2900mAh Battery",
    image_url: "images/iphone7plus.jpeg",
    category: "Phone"
  },
  {
    name: "Iphone 8 Plus",
    price: 5000000,
    short_description: "Glass design, wireless charging, stable performance",
    spec: "5.5in Retina HD, A11 Bionic, 3GB RAM, 2691mAh Battery",
    image_url: "images/iphone8plus.webp",
    category: "Phone"
  },
  {
    name: "Iphone 11",
    price: 10000000,
    short_description: "iPhone 11 with dual cameras, great battery, colorful design",
    spec: "6.1in LCD, A13 Bionic, 4GB RAM, 3110mAh Battery",
    image_url: "images/iphone11.jpg",
    category: "Phone"
  },
  {
    name: "Iphone 11 Pro",
    price: 12000000,
    short_description: "OLED display, powerful performance, triple lens camera",
    spec: "5.8in OLED, A13 Bionic, 4GB RAM, 3 cameras, 3046mAh Battery",
    image_url: "images/iphone11pro.jpg",
    category: "Phone"
  },
  {
    name: "Iphone 12",
    price: 20000000,
    short_description: "iPhone 12 with 6.1 inch screen, A14 Bionic chip",
    spec: "Display: 6.1 inch OLED, Chip: A14 Bionic, RAM: 4GB, Battery: 2815mAh",
    image_url: "images/iphone-12-tim-1-600x600.jpg",
    category: "Phone"
  },
  {
    name: "Iphone 12 Pro",
    price: 25000000,
    short_description: "iPhone 12 Pro with Pro camera, LiDAR",
    spec: "Display: 6.1 inch OLED, Chip: A14 Bionic, RAM: 6GB, Camera: 3 lenses, Battery: 2815mAh",
    image_url: "images/(600x600)_crop_iphone-12-pro-xtmobile.webp",
    category: "Phone"
  },
  {
    name: "Iphone 14 Pro Max",
    price: 26500000,
    short_description: "Dynamic Island, A16 Bionic chip",
    spec: "Display: 6.7 inch OLED, Chip: A16 Bionic, RAM: 6GB, Camera: 48MP, Battery: 4323mAh",
    image_url: "images/iphone14promax.webp",
    category: "Phone"
  },
  {
    name: "Iphone 15 Pro Max",
    price: 27500000,
    short_description: "Titanium frame, A17 Pro chip",
    spec: "Display: 6.7 inch OLED, Chip: A17 Pro, RAM: 8GB, Camera: 48MP, Battery: 4422mAh",
    image_url: "images/iphone15promax.webp",
    category: "Phone"
  },
  {
    name: "Iphone 16 Pro Max",
    price: 31000000,
    short_description: "Larger display, A18 Pro chip",
    spec: "Display: 6.9 inch OLED, Chip: A18 Pro, RAM: 8GB, Camera: 48MP, Battery: 4700mAh",
    image_url: "images/iphone16promax.jpg",
    category: "Phone"
  },
  {
    name: "MacBook Air 15\" M3",
    price: 32000000,
    short_description: "Large 15-inch screen, powerful M3 chip, thin and light design",
    spec: "M3 8-core CPU, 10-core GPU, 8GB RAM (base), 256GB SSD (base), 15.3\" Display, Wi-Fi 6E",
    image_url: "images/mba15-midnight-select-202306.jpg",
    category: "Laptop"
  },
  {
    name: "iMac 24\" M3",
    price: 33000000,
    short_description: "Stunning All-in-One, M3 chip, 4.5K Retina display",
    spec: "M3 8-core CPU, 8/10-core GPU, 8GB RAM (base), 256GB SSD (base), 23.5\" 4.5K Retina Display",
    image_url: "images/imac24.jpg",
    category: "Desktop"
  },
  {
    name: "Mac mini M2",
    price: 15000000,
    short_description: "Compact desktop, impressive performance with M2 chip",
    spec: "M2 8-core CPU, 10-core GPU, 8GB RAM (base), 256GB SSD (base), Wi-Fi 6E, Thunderbolt 4",
    image_url: "images/Mac mini M2.jpg",
    category: "Desktop"
  },
  {
    name: "iPhone SE (3rd gen)",
    price: 10000000,
    short_description: "Powerful performance in a compact design, A15 Bionic chip",
    spec: "4.7\" Retina HD Display, A15 Bionic, 4GB RAM, 12MP Camera, Touch ID, 5G",
    image_url: "images/iPhone SE (3rd gen).webp",
    category: "Phone"
  },
  {
    name: "iPhone 13",
    price: 15000000,
    short_description: "Powerful A15 Bionic chip, improved dual cameras, great battery life",
    spec: "6.1\" Super Retina XDR, A15 Bionic, 4GB RAM, Dual 12MP Cameras, 3240mAh Battery",
    image_url: "images/iPhone 13.webp",
    category: "Phone"
  },
  {
    name: "iPhone 14",
    price: 17000000,
    short_description: "Crash Detection, upgraded camera, A15 Bionic chip",
    spec: "6.1\" Super Retina XDR, A15 Bionic (5-core GPU), 6GB RAM, Dual 12MP Cameras, Crash Detection",
    image_url: "images/iPhone 14.webp",
    category: "Phone"
  },
  {
    name: "iPhone 15 Plus",
    price: 23000000,
    short_description: "Large 6.7 inch display, Dynamic Island, 48MP camera, USB-C",
    spec: "6.7\" Super Retina XDR, A16 Bionic, 6GB RAM, Dual 48MP Cameras, Large Battery, USB-C",
    image_url: "images/iPhone 15 Plus.jpg",
    category: "Phone"
  },
  {
    name: "AirPods (3rd gen)",
    price: 4000000,
    short_description: "New design, Spatial Audio, Adaptive EQ",
    spec: "H1 chip, Spatial Audio, Adaptive EQ, IPX4, 6 hours battery life",
    image_url: "images/AirPods (3rd gen).jpg",
    category: "HeadPhone"
  },
  {
    name: "AirPods Max",
    price: 13000000,
    short_description: "Premium over-ear headphones, Active Noise Cancelling, Hi-Fi audio",
    spec: "H1 chip (each ear cup), ANC, Transparency Mode, Spatial Audio, Digital Crown",
    image_url: "images/airpodmax.png",
    category: "HeadPhone"
  },
  {
    name: "Apple Watch Series 9",
    price: 10000000,
    short_description: "Powerful S9 chip, Double Tap gesture, brighter display",
    spec: "S9 SiP, Double Tap, Brighter Always-On Display, ECG, Blood Oxygen, GPS",
    image_url: "images/Apple Watch Series 9.webp",
    category: "Watch"
  },
  {
    name: "Apple Watch Ultra 2",
    price: 20000000,
    short_description: "Most rugged and capable, longest battery, pro sports features",
    spec: "S9 SiP, Double Tap, Titanium Case, Dual-frequency GPS, 100m Water Resistance, Dive computer",
    image_url: "images/Apple Watch Ultra 2.jpg",
    category: "Watch"
  },
  {
    name: "Apple Watch SE (2nd gen)",
    price: 6000000,
    short_description: "Great value, essential features, S8 chip",
    spec: "S8 SiP, Crash Detection, Heart Rate Monitoring, 50m Water Resistance, Family Setup",
    image_url: "images/AppleWatchSE.jpg",
    category: "Watch"
  },
  {
    name: "iPad Air (M2)",
    price: 15000000,
    short_description: "Powerful M2 chip, thin and light design, Apple Pencil Pro support",
    spec: "M2 chip, 11/13\" Liquid Retina Display, Landscape Front Camera, Touch ID, USB-C",
    image_url: "images/ipadairm2.webp",
    category: "iPad"
  },
  {
    name: "iPad Pro (M4)",
    price: 25000000,
    short_description: "Breakthrough M4 chip, Ultra thin Tandem OLED display, peak performance",
    spec: "M4 chip, 11/13\" Ultra Retina XDR (Tandem OLED), Ultra Thin, Face ID, USB-C (Thunderbolt)",
    image_url: "images/ipadprom4.jpg",
    category: "iPad"
  },
  {
    name: "Apple TV 4K (3rd gen)",
    price: 3500000,
    short_description: "Ultimate 4K HDR entertainment, A15 Bionic chip, new Siri Remote",
    spec: "A15 Bionic, 4K Dolby Vision & HDR10+, tvOS, Wi-Fi + Ethernet (high-end model), Siri Remote (USB-C)",
    image_url: "images/appletv4k.jpg",
    category: "TV & Home"
  },
  {
    name: "HomePod (2nd gen)",
    price: 7500000,
    short_description: "Immersive Hi-Fi audio, Smart Home integration, S7 chip",
    spec: "S7 chip, Spatial Audio, Temperature/Humidity Sensor, Thread, Matter, Siri",
    image_url: "images/homepod2.jpg",
    category: "TV & Home"
  }
];


// --- DB CONNECTION & IMPORT ---
mongoose.connect(dbURI)
  .then(async () => {
    console.log('Connected to MongoDB for data import.');
    try {
      // Optional: Clear old data
      // await Product.deleteMany({});
      // console.log('Cleared old product data.');

      // insertMany will automatically create 'products' collection if not exists
      const result = await Product.insertMany(productsToImport);
      console.log(`Successfully imported ${result.length} products.`);
    } catch (err) {
      console.error('Error importing data:', err);
    } finally {
      mongoose.connection.close(); // Close connection
      console.log('MongoDB connection closed.');
    }
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });