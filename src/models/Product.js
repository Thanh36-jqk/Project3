const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    short_description: String,
    spec: String,
    image_url: String,
    category: String,
    stock: { type: Number, default: 0 },
    colors: [{
        name: String,
        stock: { type: Number, default: 0 }
    }]
});

// Text index for search functionality
productSchema.index({ name: 'text', category: 'text' });

module.exports = mongoose.model('Product', productSchema);
