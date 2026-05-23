const { getReviews, createReview, deleteReview } = require('../../../src/controllers/reviewController');
const Review = require('../../../src/models/Review');
const Product = require('../../../src/models/Product');
const prisma = require('../../../src/config/postgres');

jest.mock('../../../src/models/Review');
jest.mock('../../../src/models/Product');
jest.mock('../../../src/config/postgres', () => ({
    order: { findFirst: jest.fn() }
}));

const VALID_PRODUCT_ID = '507f1f77bcf86cd799439011';

describe('Review Controller - getReviews', () => {
    let req, res;

    beforeEach(() => {
        req = { params: { id: VALID_PRODUCT_ID }, query: {} };
        res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        jest.clearAllMocks();
    });

    it('should return paginated reviews', async () => {
        const mockReviews = [
            { _id: 'r1', rating: 5, comment: 'Tuyệt vời', userName: 'Nguyen A' },
            { _id: 'r2', rating: 4, comment: 'Tốt', userName: 'Tran B' }
        ];
        Review.find.mockReturnValue({
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(mockReviews)
        });
        Review.countDocuments.mockResolvedValue(2);

        await getReviews(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            reviews: mockReviews,
            total: 2,
            page: 1,
            pages: 1
        });
    });

    it('should return 400 for invalid product ID', async () => {
        req.params.id = 'not-a-valid-id';

        await getReviews(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });
});

describe('Review Controller - createReview', () => {
    let req, res;

    beforeEach(() => {
        req = {
            params: { id: VALID_PRODUCT_ID },
            body: { rating: 5, comment: 'Sản phẩm tuyệt vời!' },
            user: { id: 'user-uuid-1', name: 'Nguyen A', avatar: null }
        };
        res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        jest.clearAllMocks();
    });

    it('should create a review and recalculate ratings', async () => {
        Product.findById.mockResolvedValue({ _id: VALID_PRODUCT_ID, isActive: true });
        Review.findOne.mockResolvedValue(null);
        prisma.order.findFirst.mockResolvedValue(null);

        const mockReview = { _id: 'rev-1', rating: 5, comment: 'Sản phẩm tuyệt vời!', userId: 'user-uuid-1' };
        Review.create.mockResolvedValue(mockReview);

        Review.aggregate.mockResolvedValue([{ avg: 5, count: 1 }]);
        Product.findByIdAndUpdate.mockResolvedValue({});

        await createReview(req, res);

        expect(Review.create).toHaveBeenCalledWith(expect.objectContaining({
            productId: VALID_PRODUCT_ID,
            userId: 'user-uuid-1',
            rating: 5,
            comment: 'Sản phẩm tuyệt vời!',
            isVerifiedPurchase: false
        }));
        expect(Product.findByIdAndUpdate).toHaveBeenCalledWith(
            VALID_PRODUCT_ID,
            { 'ratings.average': 5, 'ratings.count': 1 }
        );
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(mockReview);
    });

    it('should set isVerifiedPurchase=true if user bought and received the product', async () => {
        Product.findById.mockResolvedValue({ _id: VALID_PRODUCT_ID, isActive: true });
        Review.findOne.mockResolvedValue(null);
        prisma.order.findFirst.mockResolvedValue({ id: 'order-1' });

        Review.create.mockResolvedValue({ _id: 'rev-2', rating: 5, isVerifiedPurchase: true });
        Review.aggregate.mockResolvedValue([{ avg: 5, count: 1 }]);
        Product.findByIdAndUpdate.mockResolvedValue({});

        await createReview(req, res);

        expect(Review.create).toHaveBeenCalledWith(expect.objectContaining({
            isVerifiedPurchase: true
        }));
        expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 409 if user already reviewed this product', async () => {
        Product.findById.mockResolvedValue({ _id: VALID_PRODUCT_ID, isActive: true });
        Review.findOne.mockResolvedValue({ _id: 'existing-review' });

        await createReview(req, res);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(Review.create).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid rating', async () => {
        req.body.rating = 6;

        await createReview(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'Rating phải từ 1 đến 5' });
    });

    it('should return 404 if product does not exist', async () => {
        Product.findById.mockResolvedValue(null);

        await createReview(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(Review.create).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid product ID format', async () => {
        req.params.id = 'invalid-id';

        await createReview(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });
});

describe('Review Controller - deleteReview (admin)', () => {
    let req, res;

    beforeEach(() => {
        req = { params: { id: 'review-id-1' } };
        res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        jest.clearAllMocks();
    });

    it('should delete review and recalculate ratings', async () => {
        const mockReview = { _id: 'review-id-1', productId: VALID_PRODUCT_ID };
        Review.findByIdAndDelete.mockResolvedValue(mockReview);
        Review.aggregate.mockResolvedValue([]);
        Product.findByIdAndUpdate.mockResolvedValue({});

        await deleteReview(req, res);

        expect(Review.findByIdAndDelete).toHaveBeenCalledWith('review-id-1');
        expect(Product.findByIdAndUpdate).toHaveBeenCalledWith(
            VALID_PRODUCT_ID,
            { 'ratings.average': 0, 'ratings.count': 0 }
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ message: 'Review deleted successfully' });
    });

    it('should return 404 if review not found', async () => {
        Review.findByIdAndDelete.mockResolvedValue(null);

        await deleteReview(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });
});
