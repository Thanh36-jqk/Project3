// addIphone17Lineup.js — corrects the earlier placeholder "iPhone 17 Pro" entry
// with verified specs (Apple newsroom, Sept 2025) and adds the rest of the
// real iPhone 17 lineup: iPhone 17, iPhone Air, iPhone 17 Pro Max.

require('dotenv').config();
const mongoose = require('mongoose');

const dbURI = process.env.MONGO_URL || 'mongodb://localhost:27017/my-auth-db';
const Product = require('../src/models/Product');

const correction = {
  matchName: "iPhone 17 Pro",
  update: {
    price: 28500000,
    short_description: "A19 Pro chip, camera Telephoto 4x/8x mới, màn hình ProMotion 3000 nits.",
    spec: "6.3\" Super Retina XDR ProMotion 120Hz, A19 Pro, Triple 48MP Fusion cameras (4x/8x zoom), 18MP Center Stage front camera, 256GB base, Cosmic Orange/Deep Blue/Silver",
    image_url: "images/2026 new/iphone 17 pro.png",
  }
};

const newProducts = [
  {
    name: "iPhone 17",
    price: 20500000,
    short_description: "Chip A19 mới, camera Fusion 48MP kép, màn hình ProMotion 120Hz lần đầu trên bản thường.",
    spec: "6.3\" Super Retina XDR ProMotion 120Hz, A19 chip, Dual 48MP Fusion cameras, 18MP Center Stage front camera, 256GB base, Black/Lavender/Mist Blue/Sage/White",
    image_url: "images/2026 new/iphone 17.png",
    category: "Phone",
    stock: 80
  },
  {
    name: "iPhone Air",
    price: 26000000,
    short_description: "iPhone mỏng nhất từ trước đến nay (5.6mm), chip A19 Pro + N1 + C1X.",
    spec: "5.6mm siêu mỏng, 6.5\" Super Retina XDR ProMotion, A19 Pro + N1 + C1X, 48MP Fusion camera, 18MP Center Stage, 256GB base, Space Black/Cloud White/Light Gold/Sky Blue",
    image_url: "images/2026 new/iphone air.png",
    category: "Phone",
    stock: 65
  },
  {
    name: "iPhone 17 Pro Max",
    price: 31500000,
    short_description: "Màn hình lớn nhất 6.9 inch, pin 39 giờ phát video, lần đầu có tùy chọn 2TB.",
    spec: "6.9\" Super Retina XDR ProMotion 120Hz, A19 Pro, Triple 48MP Fusion cameras (4x/8x zoom), 18MP Center Stage front camera, 256GB base (up to 2TB), 39h video playback",
    image_url: "images/2026 new/iphone 17 pro.png",
    category: "Phone",
    stock: 75
  }
];

mongoose.connect(dbURI)
  .then(async () => {
    console.log('Connected to MongoDB.');
    try {
      const result = await Product.updateOne({ name: correction.matchName }, { $set: correction.update });
      console.log(`Correction for "${correction.matchName}": matched ${result.matchedCount}, modified ${result.modifiedCount}`);

      const existingNames = new Set((await Product.find({ name: { $in: newProducts.map(p => p.name) } }).select('name')).map(p => p.name));
      const toInsert = newProducts.filter(p => !existingNames.has(p.name));
      if (existingNames.size > 0) {
        console.log(`Skipping ${existingNames.size} already-existing product(s): ${[...existingNames].join(', ')}`);
      }
      if (toInsert.length > 0) {
        const result = await Product.insertMany(toInsert);
        console.log(`Successfully inserted ${result.length} new product(s).`);
      } else {
        console.log('Nothing new to insert.');
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      mongoose.connection.close();
      console.log('MongoDB connection closed.');
    }
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });
