const Product = require('../models/Product');

/**
 * Search products
 */
exports.searchProducts = async (req, res) => {
    try {
        const { q, limit } = req.query;
        if (!q) return res.status(200).json({ products: [] });

        const products = await Product.find({
            name: { $regex: q, $options: 'i' }
        }).limit(parseInt(limit) || 20);

        res.status(200).json({ products });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get all products
 */
exports.getAllProducts = async (req, res) => {
    try {
        const products = await Product.find().sort({ name: 1 });
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get product by ID
 */
exports.getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.status(200).json(product);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Create new product (Admin only)
 */
exports.createProduct = async (req, res) => {
    try {
        const newProduct = new Product(req.body);
        await newProduct.save();
        res.status(201).json(newProduct);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Update product (Admin only)
 */
exports.updateProduct = async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        res.status(200).json(product);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Update product stock (Admin only)
 */
exports.updateStock = async (req, res) => {
    try {
        const { newStock } = req.body;
        if (newStock < 0) {
            return res.status(400).json({ message: "Stock cannot be negative" });
        }

        const product = await Product.findByIdAndUpdate(
            req.params.id,
            { stock: newStock },
            { new: true }
        );
        res.status(200).json({ message: "Stock updated successfully", product });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Delete product (Admin only)
 */
exports.deleteProduct = async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
