const User = require('../models/User');
const Product = require('../models/Product');

/**
 * Get user's wishlist
 */
exports.getWishlist = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('wishlist.productId');
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Filter out any null products (in case product was deleted)
        const validWishlist = user.wishlist.filter(item => item.productId !== null);

        res.status(200).json({ wishlist: validWishlist });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Add product to wishlist
 */
exports.addToWishlist = async (req, res) => {
    try {
        const { productId } = req.body;
        if (!productId) {
            return res.status(400).json({ message: "Product ID is required" });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Check if product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        // Check if product already in wishlist
        const alreadyExists = user.wishlist.some(item => item.productId.toString() === productId);
        if (alreadyExists) {
            return res.status(400).json({ message: "Product already in wishlist" });
        }

        // Add to wishlist
        user.wishlist.push({ productId, addedAt: new Date() });
        await user.save();

        // Return populated wishlist
        const updatedUser = await User.findById(req.user.id).populate('wishlist.productId');
        res.status(200).json({ message: "Added to wishlist", wishlist: updatedUser.wishlist });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Remove product from wishlist
 */
exports.removeFromWishlist = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Remove from wishlist
        user.wishlist = user.wishlist.filter(
            item => item.productId.toString() !== req.params.productId
        );
        await user.save();

        // Return populated wishlist
        const updatedUser = await User.findById(req.user.id).populate('wishlist.productId');
        res.status(200).json({ message: "Removed from wishlist", wishlist: updatedUser.wishlist });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
