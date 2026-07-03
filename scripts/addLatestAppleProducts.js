// addLatestAppleProducts.js — adds Apple's actual March 2026 lineup (verified via
// apple.com newsroom + product pages, images downloaded from apple.com), and
// corrects the two earlier placeholder entries that had guessed (wrong) chip specs.
// Safe to re-run for the "toInsert" part: skips names that already exist.

require('dotenv').config();
const mongoose = require('mongoose');

const dbURI = process.env.MONGO_URL || 'mongodb://localhost:27017/my-auth-db';
const Product = require('../src/models/Product');

// Corrections for the two products added earlier with guessed (incorrect) chip generation.
const corrections = [
  {
    matchName: "MacBook Pro 14-inch M4",
    update: {
      name: "MacBook Pro 14-inch M5 Pro",
      price: 48000000,
      short_description: "Up to 4x AI performance vs the previous generation, with the new M5 Pro chip.",
      spec: "M5 Pro chip, 1TB SSD (base), 14.2\" Liquid Retina XDR, Wi-Fi 7, Bluetooth 6, Space Black/Silver",
      image_url: "images/2026 new/macbook pro m5.png",
    }
  },
  {
    matchName: "MacBook Air 13-inch M4",
    update: {
      name: "MacBook Air 13-inch M5",
      price: 29000000,
      short_description: "Faster CPU, next-generation GPU — built for creative work and AI tasks.",
      spec: "M5 chip, 512GB SSD (base), 13.6\" Liquid Retina Display, Wi-Fi 7, Bluetooth 6, Sky Blue/Midnight/Starlight/Silver",
      image_url: "images/2026 new/macbook air m5.png",
    }
  }
];

// New products from Apple's March 11, 2026 announcement.
const newProducts = [
  {
    name: "iPhone 17e",
    price: 16000000,
    short_description: "The newest generation of iPhone e — 256GB base storage, A19 chip.",
    spec: "6.1\" Super Retina XDR, A19 chip, 48MP Fusion camera, MagSafe wireless charging, 256GB base storage",
    image_url: "images/2026 new/iphone 17e.png",
    category: "Phone",
    stock: 70
  },
  {
    name: "iPad Air (M4)",
    price: 16000000,
    short_description: "30% faster than the M3 iPad Air, 2.3x faster than the original M1 model.",
    spec: "M4 chip, 11\"/13\" Liquid Retina Display, 12MP Wide camera, USB-C, Apple Pencil Pro support",
    image_url: "images/2026 new/ipad air m4.png",
    category: "iPad",
    stock: 55
  },
  {
    name: "MacBook Neo",
    price: 14500000,
    short_description: "Apple's new low-cost Mac laptop — fanless, silent, all-day battery.",
    spec: "A18 Pro chip (6-core CPU, 5-core GPU), 13\" Liquid Retina Display, up to 16 hours battery, fanless design, Silver/Blush/Citrus/Indigo",
    image_url: "images/2026 new/macbook neo.png",
    category: "Laptop",
    stock: 60
  }
];

mongoose.connect(dbURI)
  .then(async () => {
    console.log('Connected to MongoDB.');
    try {
      for (const { matchName, update } of corrections) {
        const result = await Product.updateOne({ name: matchName }, { $set: update });
        console.log(`Correction for "${matchName}": matched ${result.matchedCount}, modified ${result.modifiedCount}`);
      }

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
