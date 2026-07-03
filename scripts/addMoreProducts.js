// addMoreProducts.js — adds NEW products (not already in the store) using
// images that already exist under public/assets/images but weren't wired
// to any product yet. Safe to re-run: skips any name that already exists.

require('dotenv').config();
const mongoose = require('mongoose');

const dbURI = process.env.MONGO_URL || 'mongodb://localhost:27017/my-auth-db';
const Product = require('../src/models/Product');

const newProducts = [
  {
    name: "iPhone X",
    price: 6500000,
    short_description: "The future of the smartphone. Edge-to-edge OLED display, Face ID.",
    spec: "5.8in Super Retina OLED, A11 Bionic, 3GB RAM, Dual 12MP Cameras, Face ID, Wireless Charging",
    image_url: "images/iphoneX.jpg",
    category: "Phone",
    stock: 60
  },
  {
    name: "iPhone XS",
    price: 7500000,
    short_description: "The most advanced smartphone ever, with Smart HDR camera.",
    spec: "5.8in Super Retina OLED, A12 Bionic, 4GB RAM, Dual 12MP Cameras, Smart HDR, IP68 Water Resistance",
    image_url: "images/iphonexs.jpg",
    category: "Phone",
    stock: 55
  },
  {
    name: "iPhone XS Max",
    price: 9000000,
    short_description: "Bigger, brighter, more brilliant. The largest display ever on an iPhone.",
    spec: "6.5in Super Retina OLED, A12 Bionic, 4GB RAM, Dual 12MP Cameras, Smart HDR, IP68 Water Resistance",
    image_url: "images/iphonexsmax.jpg",
    category: "Phone",
    stock: 50
  },
  {
    name: "iPhone 11 Pro Max",
    price: 14000000,
    short_description: "Triple-camera system, the toughest glass ever in a smartphone.",
    spec: "6.5in Super Retina XDR OLED, A13 Bionic, 4GB RAM, Triple 12MP Cameras, 3969mAh Battery",
    image_url: "images/iphone11promax.jpg",
    category: "Phone",
    stock: 65
  },
  {
    name: "iPhone 17 Pro",
    price: 34000000,
    short_description: "The newest Pro lineup — next-gen chip and upgraded camera system. (Thông số tham khảo, nên đối chiếu apple.com/vn trước khi bán chính thức)",
    spec: "A19 Pro chip, Pro camera system, ProMotion display, USB-C",
    image_url: "images/iphone17pro.jpg",
    category: "Phone",
    stock: 40
  },
  {
    name: "MacBook Pro 14-inch M4",
    price: 42000000,
    short_description: "Mind-blowing performance with the M4 chip, Liquid Retina XDR display.",
    spec: "M4 10-core CPU, 10-core GPU, 16GB RAM (base), 512GB SSD (base), 14.2\" Liquid Retina XDR, 1080p FaceTime HD camera",
    image_url: "images/apple-macbook-pro-14-16-inch-jpeg-b2dc7a7d-d44c-4d26-ad51-a97756e6e9a7.webp",
    category: "Laptop",
    stock: 30
  },
  {
    name: "MacBook Air 13-inch M4",
    price: 28000000,
    short_description: "Strikingly thin, incredibly capable — now with the M4 chip.",
    spec: "M4 8-core CPU, 8-core GPU, 16GB RAM (base), 256GB SSD (base), 13.6\" Liquid Retina Display, 12MP Center Stage camera",
    image_url: "images/mba13-skyblue-select-202503.jpg",
    category: "Laptop",
    stock: 45
  },
  {
    name: "iPad (10th generation)",
    price: 10500000,
    short_description: "Colorful, capable, and totally redesigned — the all-new iPad.",
    spec: "A14 Bionic, 10.9\" Liquid Retina Display, 12MP Wide camera, USB-C, Landscape stereo speakers",
    image_url: "images/ipad (10th gen)/ipad gen 10 blue.webp",
    category: "iPad",
    stock: 50
  },
  {
    name: "iPad mini 6",
    price: 13500000,
    short_description: "Mega power. Mini size. Fits perfectly in one hand.",
    spec: "A15 Bionic, 8.3\" Liquid Retina Display, 12MP Wide camera, USB-C, Touch ID on top button, Apple Pencil (2nd gen) support",
    image_url: "images/ipad mini 6/ipad mini 6 purple.png",
    category: "iPad",
    stock: 40
  }
];

mongoose.connect(dbURI)
  .then(async () => {
    console.log('Connected to MongoDB.');
    try {
      const existingNames = new Set((await Product.find({ name: { $in: newProducts.map(p => p.name) } }).select('name')).map(p => p.name));
      const toInsert = newProducts.filter(p => !existingNames.has(p.name));

      if (existingNames.size > 0) {
        console.log(`Skipping ${existingNames.size} already-existing product(s): ${[...existingNames].join(', ')}`);
      }
      if (toInsert.length === 0) {
        console.log('Nothing new to insert.');
      } else {
        const result = await Product.insertMany(toInsert);
        console.log(`Successfully inserted ${result.length} new product(s).`);
      }
    } catch (err) {
      console.error('Error importing data:', err);
    } finally {
      mongoose.connection.close();
      console.log('MongoDB connection closed.');
    }
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });
