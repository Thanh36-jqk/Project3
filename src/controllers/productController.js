const Product = require('../models/Product');

const PRODUCT_LIST_FIELDS = 'name slug price compareAtPrice short_description image_url category stock colors ratings isActive';

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

exports.searchProducts = async (req, res) => {
    try {
        const { q, limit } = req.query;
        if (!q) return res.status(200).json({ products: [] });

        const products = await Product.find({
            name: { $regex: escapeRegex(q), $options: 'i' },
            isActive: true
        })
            .select(PRODUCT_LIST_FIELDS)
            .limit(parseInt(limit) || 20)
            .lean();

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
        const { category, limit, page } = req.query;
        const query = { isActive: true };
        if (category) query.category = category;

        const pageSize = Math.min(parseInt(limit) || 100, 200);
        const skip = (parseInt(page) - 1 || 0) * pageSize;

        const products = await Product.find(query)
            .select(PRODUCT_LIST_FIELDS)
            .sort({ name: 1 })
            .skip(skip)
            .limit(pageSize)
            .lean();

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

        if (colors !== undefined) {
            if (!Array.isArray(colors) || colors.length === 0) {
                return res.status(400).json({ message: "colors must be a non-empty array" });
            }
            const normalized = colors.map(c => {
                const s = parseInt(c.stock);
                if (!Number.isInteger(s) || s < 0) {
                    throw Object.assign(new Error(`Invalid stock for color "${c.name}"`), { status: 400 });
                }
                return { name: c.name, hex: c.hex || '#cccccc', stock: s };
            });
            const calculatedStock = normalized.reduce((sum, c) => sum + c.stock, 0);
            updateQuery = { colors: normalized, stock: calculatedStock };
        } else if (newStock !== undefined) {
            const parsed = parseInt(newStock);
            if (!Number.isInteger(parsed) || parsed < 0) {
                return res.status(400).json({ message: "newStock must be a non-negative integer" });
            }
            updateQuery = { stock: parsed };
        } else {
            return res.status(400).json({ message: "Must provide newStock or colors array" });
        }

        const product = await Product.findByIdAndUpdate(req.params.id, updateQuery, { new: true });
        if (!product) return res.status(404).json({ message: "Product not found" });

        res.status(200).json({ message: "Stock updated successfully", product });
    } catch (error) {
        if (error.status === 400) return res.status(400).json({ message: error.message });
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
