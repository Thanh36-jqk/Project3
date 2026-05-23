const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');
const prisma = require('../config/postgres');

async function recalculateProductRatings(productId) {
    const agg = await Review.aggregate([
        { $match: { productId: new mongoose.Types.ObjectId(productId) } },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);
    const avg = agg[0] ? Math.round(agg[0].avg * 10) / 10 : 0;
    const count = agg[0] ? agg[0].count : 0;
    await Product.findByIdAndUpdate(productId, {
        'ratings.average': avg,
        'ratings.count': count
    });
}

exports.recalculateProductRatings = recalculateProductRatings;

exports.getReviews = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid product ID' });
        }

        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 10);
        const skip = (page - 1) * limit;

        const [reviews, total] = await Promise.all([
            Review.find({ productId: id }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            Review.countDocuments({ productId: id })
        ]);

        res.status(200).json({
            reviews,
            total,
            page,
            pages: Math.ceil(total / limit)
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createReview = async (req, res) => {
    try {
        const { id } = req.params;
        const { rating, comment } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid product ID' });
        }

        const ratingNum = parseInt(rating);
        if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
            return res.status(400).json({ message: 'Rating phải từ 1 đến 5' });
        }

        const product = await Product.findById(id);
        if (!product || !product.isActive) {
            return res.status(404).json({ message: 'Sản phẩm không tồn tại' });
        }

        const existing = await Review.findOne({ productId: id, userId: req.user.id });
        if (existing) {
            return res.status(409).json({ message: 'Bạn đã đánh giá sản phẩm này rồi' });
        }

        const hasPurchased = await prisma.order.findFirst({
            where: {
                userId: req.user.id,
                status: { in: ['Completed', 'Delivered'] },
                items: { some: { productId: id } }
            }
        });

        const review = await Review.create({
            productId: id,
            userId: req.user.id,
            userName: req.user.name || 'Khách hàng',
            userAvatar: req.user.avatar || null,
            rating: ratingNum,
            comment: comment?.trim() || '',
            isVerifiedPurchase: !!hasPurchased
        });

        await recalculateProductRatings(id);

        res.status(201).json(review);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: 'Bạn đã đánh giá sản phẩm này rồi' });
        }
        res.status(500).json({ message: error.message });
    }
};

exports.deleteReview = async (req, res) => {
    try {
        const review = await Review.findByIdAndDelete(req.params.id);
        if (!review) return res.status(404).json({ message: 'Review not found' });

        await recalculateProductRatings(review.productId.toString());

        res.status(200).json({ message: 'Review deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
