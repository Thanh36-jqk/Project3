const Product = require('../models/Product');

/**
 * Search products
 */
exports.searchProducts = async (req, res) => {
    try {
        const { q, limit } = req.query;
        if (!q) return res.status(200).json({ products: [] });

        const products = await Product.find({
            name: { $regex: q, $options: 'i' },
            isActive: true
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
        const products = await Product.find({ isActive: true }).sort({ name: 1 });
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
        if (!product || !product.isActive) {
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
        const productData = req.body;
        
        // Calculate total stock if color variants are provided
        if (productData.colors && productData.colors.length > 0) {
            productData.stock = productData.colors.reduce((total, color) => total + (Number(color.stock) || 0), 0);
        }

        const newProduct = new Product(productData);
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
        const updateData = req.body;

        // Calculate total stock if color variants are provided
        if (updateData.colors && updateData.colors.length > 0) {
            updateData.stock = updateData.colors.reduce((total, color) => total + (Number(color.stock) || 0), 0);
        }

        const product = await Product.findByIdAndUpdate(
            req.params.id,
            updateData,
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
        const { newStock, colors } = req.body;
        
        let updateQuery = {};
        
        if (colors && Array.isArray(colors)) {
            // Calculate total stock from colors
            const calculatedStock = colors.reduce((total, color) => total + (Number(color.stock) || 0), 0);
            updateQuery = { colors: colors, stock: calculatedStock };
        } else if (newStock !== undefined) {
             if (newStock < 0) {
                 return res.status(400).json({ message: "Stock cannot be negative" });
             }
             updateQuery = { stock: newStock };
        } else {
             return res.status(400).json({ message: "Must provide newStock or colors array" });
        }

        const product = await Product.findByIdAndUpdate(
            req.params.id,
            updateQuery,
            { new: true }
        );
        res.status(200).json({ message: "Stock updated successfully", product });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Delete product — SOFT DELETE (Admin only)
 * Sets isActive=false instead of removing from DB.
 * This preserves order history integrity — old orders can still reference this product.
 */
exports.deleteProduct = async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            { isActive: false },
            { new: true }
        );
        if (!product) return res.status(404).json({ message: 'Product not found' });
        res.status(200).json({ message: 'Product deactivated successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
