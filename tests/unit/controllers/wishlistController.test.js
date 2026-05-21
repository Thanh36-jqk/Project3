const wishlistController = require('../../../src/controllers/wishlistController');
const Product = require('../../../src/models/Product');
const prisma = require('../../../src/config/postgres');

jest.mock('../../../src/models/Product');
jest.mock('../../../src/config/postgres', () => ({
    user: {
        findUnique: jest.fn(),
        update: jest.fn(),
    }
}));

describe('Wishlist Controller', () => {
    let req, res;

    beforeEach(() => {
        req = { user: { id: 'user-1' }, body: {}, params: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        jest.clearAllMocks();
    });

    describe('getWishlist', () => {
        it('should return wishlist products for the user', async () => {
            const mockUser = { id: 'user-1', wishlist: ['prod-1', 'prod-2'] };
            const mockProducts = [
                { _id: 'prod-1', name: 'iPhone 15' },
                { _id: 'prod-2', name: 'AirPods Pro' }
            ];

            prisma.user.findUnique.mockResolvedValue(mockUser);
            Product.find.mockResolvedValue(mockProducts);

            await wishlistController.getWishlist(req, res);

            expect(Product.find).toHaveBeenCalledWith({ _id: { $in: ['prod-1', 'prod-2'] } });
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ wishlist: mockProducts });
        });

        it('should return 404 if user not found', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            await wishlistController.getWishlist(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
        });
    });

    describe('addToWishlist', () => {
        it('should add a product to the wishlist', async () => {
            req.body = { productId: 'prod-3' };
            const mockUser = { id: 'user-1', wishlist: ['prod-1'] };
            const updatedUser = { id: 'user-1', wishlist: ['prod-1', 'prod-3'] };
            const mockProducts = [{ _id: 'prod-1' }, { _id: 'prod-3' }];

            Product.findById.mockResolvedValue({ _id: 'prod-3', name: 'MacBook Air' });
            prisma.user.findUnique.mockResolvedValue(mockUser);
            prisma.user.update.mockResolvedValue(updatedUser);
            Product.find.mockResolvedValue(mockProducts);

            await wishlistController.addToWishlist(req, res);

            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: 'user-1' },
                data: { wishlist: { push: 'prod-3' } }
            });
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Added to wishlist',
            }));
        });

        it('should return 400 if productId is missing', async () => {
            req.body = {};

            await wishlistController.addToWishlist(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ message: 'Product ID is required' });
        });

        it('should return 404 if product does not exist', async () => {
            req.body = { productId: 'nonexistent' };
            Product.findById.mockResolvedValue(null);

            await wishlistController.addToWishlist(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ message: 'Product not found' });
        });

        it('should return 400 if product already in wishlist', async () => {
            req.body = { productId: 'prod-1' };
            Product.findById.mockResolvedValue({ _id: 'prod-1', name: 'iPhone 15' });
            prisma.user.findUnique.mockResolvedValue({ id: 'user-1', wishlist: ['prod-1'] });

            await wishlistController.addToWishlist(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ message: 'Product already in wishlist' });
        });
    });

    describe('removeFromWishlist', () => {
        it('should remove a product from the wishlist', async () => {
            req.params = { productId: 'prod-1' };
            const mockUser = { id: 'user-1', wishlist: ['prod-1', 'prod-2'] };
            const updatedUser = { id: 'user-1', wishlist: ['prod-2'] };
            const remainingProducts = [{ _id: 'prod-2', name: 'AirPods' }];

            prisma.user.findUnique.mockResolvedValue(mockUser);
            prisma.user.update.mockResolvedValue(updatedUser);
            Product.find.mockResolvedValue(remainingProducts);

            await wishlistController.removeFromWishlist(req, res);

            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: 'user-1' },
                data: { wishlist: { set: ['prod-2'] } }
            });
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Removed from wishlist',
            }));
        });

        it('should return 404 if user not found', async () => {
            req.params = { productId: 'prod-1' };
            prisma.user.findUnique.mockResolvedValue(null);

            await wishlistController.removeFromWishlist(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
        });
    });
});
