const Cart = require('../models/Cart');
const Product = require('../models/Product');
const dummyProducts = require('../utils/dummyProducts');
const { mergeGuestCart } = require('../services/cartMergeService');

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
 * Price, name, and image are fetched from DB or backend config to prevent price manipulation.
 */
exports.addToCart = async (req, res) => {
    try {
        const { productId, quantity } = req.body;

        // Validate input
        if (!productId || !quantity || quantity < 1) {
            return res.status(400).json({ message: "Product ID and valid quantity are required" });
        }

        // Fetch authoritative product data from DB or Dummy List
        let product = await Product.findById(productId);
        
        if (!product) {
            // Check if it's a dummy product
            const dummy = dummyProducts.find(p => p._id === productId);
            if (dummy) {
                product = {
                    _id: dummy._id,
                    name: dummy.name,
                    price: dummy.price,
                    image_url: dummy.image_url
                };
            }
        }

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
            // Refresh price in case it changed
            cart.items[itemIndex].price = product.price;
        } else {
            cart.items.push({
                productId: product._id.toString(),
                quantity,
                name: product.name,
                price: product.price,       // Always from server, never from client
                image_url: product.image_url // Always from server
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
 * Merge guest cart into the authenticated user's cart (called after OAuth login)
 */
exports.mergeCart = async (req, res) => {
    try {
        const { guestCart } = req.body;
        if (!guestCart || !Array.isArray(guestCart) || guestCart.length === 0) {
            return res.status(200).json({ message: 'Nothing to merge' });
        }
        const cart = await mergeGuestCart(req.user.id, guestCart);
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
