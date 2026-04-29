const Cart = require('../models/Cart');
const Product = require('../models/Product');

/**
 * Get user's cart
 */
exports.getCart = async (req, res) => {
    try {
        const cart = await Cart.findOne({ userId: req.user.id });
        res.status(200).json(cart || { userId: req.user.id, items: [] });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Add item to cart
 * SECURITY: Only accepts productId and quantity from client.
 * Price, name, and image are fetched from DB to prevent price manipulation.
 */
exports.addToCart = async (req, res) => {
    try {
        const { productId, quantity } = req.body;

        // Validate input
        if (!productId || !quantity || quantity < 1) {
            return res.status(400).json({ message: "Product ID and valid quantity are required" });
        }

        // Fetch authoritative product data from DB
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        let cart = await Cart.findOne({ userId: req.user.id });
        if (!cart) {
            cart = new Cart({ userId: req.user.id, items: [] });
        }

        const itemIndex = cart.items.findIndex(
            p => p.productId && p.productId.toString() === productId
        );

        if (itemIndex > -1) {
            cart.items[itemIndex].quantity += quantity;
            // Refresh price from DB in case it changed
            cart.items[itemIndex].price = product.price;
        } else {
            cart.items.push({
                productId: product._id,
                quantity,
                name: product.name,
                price: product.price,       // Always from DB, never from client
                image_url: product.image_url // Always from DB
            });
        }

        await cart.save();
        res.status(200).json(cart);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Remove item from cart
 */
exports.removeFromCart = async (req, res) => {
    try {
        const cart = await Cart.findOne({ userId: req.user.id });
        if (!cart) {
            return res.status(404).json({ message: "Cart is empty" });
        }

        cart.items = cart.items.filter(
            item => item.productId && item.productId.toString() !== req.params.productId
        );

        await cart.save();
        res.status(200).json(cart);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Clear cart
 */
exports.clearCart = async (req, res) => {
    try {
        await Cart.findOneAndUpdate(
            { userId: req.user.id },
            { $set: { items: [] } }
        );
        res.status(200).json({ message: 'Cart cleared' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
