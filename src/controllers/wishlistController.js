const prisma = require('../config/postgres');
const Product = require('../models/Product');

exports.getWishlist = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user) return res.status(404).json({ message: "User not found" });

        const products = await Product.find({ _id: { $in: user.wishlist } });
        res.status(200).json({ wishlist: products });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.addToWishlist = async (req, res) => {
    try {
        const { productId } = req.body;
        if (!productId) return res.status(400).json({ message: "Product ID is required" });

        const product = await Product.findById(productId);
        if (!product) return res.status(404).json({ message: "Product not found" });

        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user) return res.status(404).json({ message: "User not found" });

        if (user.wishlist.includes(productId)) {
            return res.status(400).json({ message: "Product already in wishlist" });
        }

        const updated = await prisma.user.update({
            where: { id: req.user.id },
            data: { wishlist: { push: productId } }
        });

        const products = await Product.find({ _id: { $in: updated.wishlist } });
        res.status(200).json({ message: "Added to wishlist", wishlist: products });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.removeFromWishlist = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user) return res.status(404).json({ message: "User not found" });

        const updated = await prisma.user.update({
            where: { id: req.user.id },
            data: { wishlist: { set: user.wishlist.filter(id => id !== req.params.productId) } }
        });

        const products = await Product.find({ _id: { $in: updated.wishlist } });
        res.status(200).json({ message: "Removed from wishlist", wishlist: products });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
