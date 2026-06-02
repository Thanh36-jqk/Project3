// fixProducts.js — remove duplicate products, fix image paths for admin dashboard
require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../src/models/Product');

async function main() {
    await mongoose.connect(process.env.MONGO_URL);
    console.log('Connected to MongoDB');

    // --- Fix 5: Remove duplicates (keep oldest by _id, delete newer ones) ---
    const all = await Product.find({}).sort({ _id: 1 }).lean();
    const seen = new Map();
    const toDelete = [];

    for (const p of all) {
        const key = p.name.trim().toLowerCase();
        if (seen.has(key)) {
            toDelete.push(p._id);
        } else {
            seen.set(key, p._id);
        }
    }

    if (toDelete.length > 0) {
        await Product.deleteMany({ _id: { $in: toDelete } });
        console.log(`Deleted ${toDelete.length} duplicate products`);
    } else {
        console.log('No duplicates found');
    }

    // --- Fix 6: Ensure image_url uses leading slash so admin dashboard resolves correctly ---
    const result = await Product.updateMany(
        { image_url: { $exists: true, $not: /^(\/|http|assets\/)/ } },
        [{ $set: { image_url: { $concat: ['/', '$image_url'] } } }]
    );
    console.log(`Fixed image paths: ${result.modifiedCount} products updated`);

    // Report final state
    const count = await Product.countDocuments();
    console.log(`Total products after cleanup: ${count}`);

    await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
