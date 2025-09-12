// models/Product.js - Code cập nhật

const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  short_description: { type: String },
  spec: { type: String }, // Hoặc [String] nếu bạn quyết định lưu thành mảng
  image_url: { type: String },
  category: { type: String }
  // Đã bỏ trường 'brand'
}, { timestamps: true }); // Tùy chọn: thêm timestamps nếu bạn muốn

// --- ĐỊNH NGHĨA TEXT INDEX NGAY TRONG SCHEMA (Đã bỏ 'brand') ---
productSchema.index({
    name: 'text',
    short_description: 'text',
    spec: 'text' // Đã bỏ 'brand'
});

const Product = mongoose.model('Product', productSchema);

// --- EXPORT MODEL ---
module.exports = Product;