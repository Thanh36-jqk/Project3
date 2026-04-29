const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    slug: { type: String, unique: true, sparse: true, index: true },  // SEO-friendly URL
    price: { type: Number, required: true },
    compareAtPrice: Number,         // Original price before sale (for "X% off" display)
    short_description: String,
    description: String,            // Full product description (HTML/Markdown)
    spec: String,
    image_url: String,
    images: [String],               // Gallery: multiple product images
    category: String,
    stock: { type: Number, default: 0 },
    colors: [{
        name: String,
        hex: String,                // Color hex code for UI display
        stock: { type: Number, default: 0 }
    }],
    isActive: { type: Boolean, default: true },  // Soft delete — never hard-delete products
    ratings: {
        average: { type: Number, default: 0, min: 0, max: 5 },
        count: { type: Number, default: 0 }
    }
}, { timestamps: true });

// Text index for search functionality
productSchema.index({ name: 'text', category: 'text', short_description: 'text' });

// Auto-generate slug from name if not provided
productSchema.pre('save', function(next) {
    if (!this.slug && this.name) {
        this.slug = this.name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
    }
    next();
});

module.exports = mongoose.model('Product', productSchema);
