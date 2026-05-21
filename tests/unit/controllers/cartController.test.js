const { addToCart, getCart, removeFromCart, mergeCart, clearCart } = require('../../../src/controllers/cartController');
const Cart = require('../../../src/models/Cart');
const Product = require('../../../src/models/Product');

jest.mock('../../../src/models/Cart');
jest.mock('../../../src/models/Product');
jest.mock('../../../src/services/cartMergeService', () => ({
    mergeGuestCart: jest.fn(),
}));
const { mergeGuestCart } = require('../../../src/services/cartMergeService');

describe('Cart Controller - addToCart', () => {
    let req, res;

    beforeEach(() => {
        req = {
            user: { id: 'user-id-123' },
            body: {
                productId: 'ip4',
                quantity: 1
            }
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        jest.clearAllMocks();
    });

    it('should successfully add a dummy product to the cart', async () => {
        // 1. Mock Product.findById to return null (not in DB)
        Product.findById.mockResolvedValue(null);

        // 2. Mock Cart.findOne to return null (new cart)
        Cart.findOne.mockResolvedValue(null);

        // 3. Mock Cart instance
        const mockCart = {
            items: [],
            save: jest.fn().mockResolvedValue(true)
        };
        Cart.mockImplementation(() => mockCart);

        // Execute
        await addToCart(req, res);

        // Assertions
        expect(Product.findById).toHaveBeenCalledWith('ip4');
        expect(mockCart.items).toHaveLength(1);
        expect(mockCart.items[0]).toEqual(expect.objectContaining({
            productId: 'ip4',
            name: 'iPhone 15',
            price: 19990000,
            image_url: expect.stringContaining('15_plus_yellow')
        }));
        expect(mockCart.save).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should successfully add a MongoDB product to the cart', async () => {
        const mongoId = '507f1f77bcf86cd799439011';
        req.body.productId = mongoId;

        Product.findById.mockResolvedValue({
            _id: mongoId,
            name: 'DB Product',
            price: 1000,
            image_url: 'db.jpg'
        });

        const mockCart = {
            items: [],
            save: jest.fn().mockResolvedValue(true)
        };
        Cart.findOne.mockResolvedValue(mockCart);

        await addToCart(req, res);

        expect(Product.findById).toHaveBeenCalledWith(mongoId);
        expect(mockCart.items[0].name).toBe('DB Product');
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 400 if productId or quantity is missing', async () => {
        req.body = { productId: 'ip4' };

        await addToCart(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'Product ID and valid quantity are required' });
    });

    it('should return 404 if product not found in DB or dummy list', async () => {
        req.body = { productId: 'unknown-product', quantity: 1 };
        Product.findById.mockResolvedValue(null);

        await addToCart(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ message: 'Product not found' });
    });

    it('should increment quantity if product already in cart', async () => {
        const mongoId = '507f1f77bcf86cd799439011';
        req.body = { productId: mongoId, quantity: 2 };

        Product.findById.mockResolvedValue({ _id: mongoId, name: 'MacBook', price: 30000000, image_url: 'mb.jpg' });

        const mockCart = {
            items: [{ productId: mongoId, quantity: 1, price: 30000000, toString: () => mongoId }],
            save: jest.fn().mockResolvedValue(true)
        };
        mockCart.items[0].productId = { toString: () => mongoId };
        Cart.findOne.mockResolvedValue(mockCart);

        await addToCart(req, res);

        expect(mockCart.save).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
    });
});

describe('Cart Controller - getCart', () => {
    let req, res;

    beforeEach(() => {
        req = { user: { id: 'user-1' } };
        res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        jest.clearAllMocks();
    });

    it('should return cart if it exists', async () => {
        const mockCart = { userId: 'user-1', items: [{ productId: 'p1', qty: 1 }] };
        Cart.findOne.mockResolvedValue(mockCart);

        await getCart(req, res);

        expect(Cart.findOne).toHaveBeenCalledWith({ userId: 'user-1' });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(mockCart);
    });

    it('should return empty cart if no cart found', async () => {
        Cart.findOne.mockResolvedValue(null);

        await getCart(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ userId: 'user-1', items: [] });
    });
});

describe('Cart Controller - removeFromCart', () => {
    let req, res;

    beforeEach(() => {
        req = { user: { id: 'user-1' }, params: { productId: 'prod-1' } };
        res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        jest.clearAllMocks();
    });

    it('should remove an item from the cart', async () => {
        const mockCart = {
            userId: 'user-1',
            items: [
                { productId: { toString: () => 'prod-1' } },
                { productId: { toString: () => 'prod-2' } }
            ],
            save: jest.fn().mockResolvedValue(true)
        };
        Cart.findOne.mockResolvedValue(mockCart);

        await removeFromCart(req, res);

        expect(mockCart.save).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 if cart is empty', async () => {
        Cart.findOne.mockResolvedValue(null);

        await removeFromCart(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ message: 'Cart is empty' });
    });
});

describe('Cart Controller - mergeCart', () => {
    let req, res;

    beforeEach(() => {
        req = { user: { id: 'user-1' }, body: {} };
        res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        jest.clearAllMocks();
    });

    it('should return 200 with nothing to merge if guestCart is empty', async () => {
        req.body = { guestCart: [] };

        await mergeCart(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ message: 'Nothing to merge' });
    });

    it('should merge guest cart into user cart', async () => {
        req.body = { guestCart: [{ productId: 'p1', quantity: 1 }] };
        const mergedCart = { userId: 'user-1', items: [{ productId: 'p1', quantity: 1 }] };
        mergeGuestCart.mockResolvedValue(mergedCart);

        await mergeCart(req, res);

        expect(mergeGuestCart).toHaveBeenCalledWith('user-1', req.body.guestCart);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(mergedCart);
    });
});

describe('Cart Controller - clearCart', () => {
    let req, res;

    beforeEach(() => {
        req = { user: { id: 'user-1' } };
        res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        jest.clearAllMocks();
    });

    it('should clear all items from the cart', async () => {
        Cart.findOneAndUpdate.mockResolvedValue({ userId: 'user-1', items: [] });

        await clearCart(req, res);

        expect(Cart.findOneAndUpdate).toHaveBeenCalledWith(
            { userId: 'user-1' },
            { $set: { items: [] } }
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ message: 'Cart cleared' });
    });
});
