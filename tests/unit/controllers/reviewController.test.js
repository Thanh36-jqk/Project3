const { getReviews, checkMyReview, createReview, deleteReview, getAllReviews } = require('../../../src/controllers/reviewController');
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

    it('should return paginated reviews with breakdown', async () => {
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
        Review.aggregate.mockResolvedValue([
            { _id: 5, count: 1 },
            { _id: 4, count: 1 }
        ]);

        await getReviews(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        const response = res.json.mock.calls[0][0];
        expect(response.reviews).toEqual(mockReviews);
        expect(response.total).toBe(2);
        expect(response.breakdown).toBeDefined();
        expect(response.breakdown[5]).toBe(1);
        expect(response.breakdown[4]).toBe(1);
        expect(response.breakdown[1]).toBe(0);
    });

    it('should filter by star rating when filterRating param provided', async () => {
        req.query = { filterRating: '5' };
        Review.find.mockReturnValue({
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue([])
        });
        Review.countDocuments.mockResolvedValue(0);
        Review.aggregate.mockResolvedValue([]);

        await getReviews(req, res);

        expect(Review.find).toHaveBeenCalledWith(expect.objectContaining({ rating: 5 }));
    });

    it('should return 400 for invalid product ID', async () => {
        req.params.id = 'not-a-valid-id';

        await getReviews(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });
});

describe('Review Controller - checkMyReview', () => {
    let req, res;

    beforeEach(() => {
        req = { params: { id: VALID_PRODUCT_ID }, user: { id: 'user-uuid-1' } };
        res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        jest.clearAllMocks();
    });

    it('should return 200 with review if user already reviewed', async () => {
        const mockReview = { _id: 'rev-1', rating: 4, comment: 'Good', userId: 'user-uuid-1' };
        Review.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockReview) });

        await checkMyReview(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(mockReview);
    });

    it('should return 404 if user has not reviewed', async () => {
        Review.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

        await checkMyReview(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 for invalid product ID', async () => {
        req.params.id = 'invalid-id';

        await checkMyReview(req, res);

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

    it('should return 403 if user has not purchased the product', async () => {
        Product.findById.mockResolvedValue({ _id: VALID_PRODUCT_ID, isActive: true });
        Review.findOne.mockResolvedValue(null);
        prisma.order.findFirst.mockResolvedValue(null);

        await createReview(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ message: 'Bạn cần mua sản phẩm này trước khi đánh giá' });
        expect(Review.create).not.toHaveBeenCalled();
    });

    it('should create review and return { review, updatedRatings } for verified buyer', async () => {
        Product.findById
            .mockResolvedValueOnce({ _id: VALID_PRODUCT_ID, isActive: true })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue({ ratings: { average: 5, count: 1 } })
            });
        Review.findOne.mockResolvedValue(null);
        prisma.order.findFirst.mockResolvedValue({ id: 'order-1' });

        const mockReview = { _id: 'rev-1', rating: 5, isVerifiedPurchase: true };
        Review.create.mockResolvedValue(mockReview);
        Review.aggregate.mockResolvedValue([{ avg: 5, count: 1 }]);
        Product.findByIdAndUpdate.mockResolvedValue({});

        await createReview(req, res);

        expect(Review.create).toHaveBeenCalledWith(expect.objectContaining({
            isVerifiedPurchase: true
        }));
        expect(res.status).toHaveBeenCalledWith(201);
        const response = res.json.mock.calls[0][0];
        expect(response.review).toBeDefined();
        expect(response.updatedRatings).toBeDefined();
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
    });

    it('should return 404 if review not found', async () => {
        Review.findByIdAndDelete.mockResolvedValue(null);

        await deleteReview(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });
});

describe('Review Controller - getAllReviews (admin)', () => {
    let req, res;

    beforeEach(() => {
        req = { query: {} };
        res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        jest.clearAllMocks();
    });

    it('should return paginated list of all reviews', async () => {
        const mockReviews = [
            { _id: 'r1', rating: 5, userName: 'User A' },
            { _id: 'r2', rating: 3, userName: 'User B' }
        ];
        Review.find.mockReturnValue({
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(mockReviews)
        });
        Review.countDocuments.mockResolvedValue(2);

        await getAllReviews(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        const response = res.json.mock.calls[0][0];
        expect(response.reviews).toEqual(mockReviews);
        expect(response.total).toBe(2);
        expect(response.page).toBe(1);
        expect(response.pages).toBe(1);
    });

    it('should respect page and limit query params', async () => {
        req.query = { page: '2', limit: '5' };
        Review.find.mockReturnValue({
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue([])
        });
        Review.countDocuments.mockResolvedValue(10);

        await getAllReviews(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        const response = res.json.mock.calls[0][0];
        expect(response.page).toBe(2);
        expect(response.pages).toBe(2);
    });
});
