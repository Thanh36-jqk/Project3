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

        const filterRating = parseInt(req.query.filterRating);
        const query = { productId: id };
        if (filterRating >= 1 && filterRating <= 5) {
            query.rating = filterRating;
        }

        const sortBy = req.query.sort === 'verified'
            ? { isVerifiedPurchase: -1, createdAt: -1 }
            : { createdAt: -1 };

        const [reviews, total, breakdownAgg] = await Promise.all([
            Review.find(query).sort(sortBy).skip(skip).limit(limit).lean(),
            Review.countDocuments(query),
            Review.aggregate([
                { $match: { productId: new mongoose.Types.ObjectId(id) } },
                { $group: { _id: '$rating', count: { $sum: 1 } } }
            ])
        ]);

        const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        breakdownAgg.forEach(b => { breakdown[b._id] = b.count; });

        res.status(200).json({
            reviews,
            total,
            page,
            pages: Math.ceil(total / limit),
            breakdown
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.checkMyReview = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid product ID' });
        }

        const review = await Review.findOne({ productId: id, userId: req.user.id }).lean();
        if (!review) return res.status(404).json({ message: 'No review found' });

        res.status(200).json(review);
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

        const reviewer = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { name: true, avatar: true }
        });

        const hasPurchased = await prisma.order.findFirst({
            where: {
                userId: req.user.id,
                status: { in: ['Confirmed'] },
                items: { some: { productId: id } }
            }
        });

        if (!hasPurchased) {
            return res.status(403).json({ message: 'Bạn cần mua sản phẩm này trước khi đánh giá' });
        }

        const review = await Review.create({
            productId: id,
            userId: req.user.id,
            userName: reviewer?.name || 'Khách hàng',
            userAvatar: reviewer?.avatar || null,
            rating: ratingNum,
            comment: comment?.trim() || '',
            isVerifiedPurchase: true
        });

        await recalculateProductRatings(id);

        const updatedProduct = await Product.findById(id).select('ratings').lean();
        res.status(201).json({ review, updatedRatings: updatedProduct.ratings });
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

exports.getAllReviews = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 20);
        const skip = (page - 1) * limit;

        const [reviews, total] = await Promise.all([
            Review.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            Review.countDocuments({})
        ]);

        res.status(200).json({ reviews, total, page, pages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
