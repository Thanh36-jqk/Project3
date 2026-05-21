const { mergeGuestCart } = require('../../../src/services/cartMergeService');
const Cart = require('../../../src/models/Cart');
const Product = require('../../../src/models/Product');

jest.mock('../../../src/models/Cart');
jest.mock('../../../src/models/Product');

describe('cartMergeService - mergeGuestCart', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterAll(() => jest.restoreAllMocks());

    it('should return existing cart if guestCartItems is empty', async () => {
        const existingCart = { userId: 'user-1', items: [] };
        Cart.findOne.mockResolvedValue(existingCart);

        const result = await mergeGuestCart('user-1', []);

        expect(Cart.findOne).toHaveBeenCalledWith({ userId: 'user-1' });
        expect(result).toBe(existingCart);
    });

    it('should create a new cart and merge guest items when no existing cart', async () => {
        Cart.findOne.mockResolvedValue(null);

        const mockCartInstance = {
            userId: 'user-1',
            items: [],
            save: jest.fn().mockResolvedValue(true)
        };
        Cart.mockImplementation(() => mockCartInstance);

        const mockProduct = { _id: 'prod-1', name: 'iPhone 15', price: 19990000, image_url: 'iphone.jpg', isActive: true };
        Product.findById.mockResolvedValue(mockProduct);

        const guestItems = [{ productId: 'prod-1', quantity: 2 }];

        await mergeGuestCart('user-1', guestItems);

        expect(mockCartInstance.items).toHaveLength(1);
        expect(mockCartInstance.items[0]).toMatchObject({
            productId: 'prod-1',
            quantity: 2,
            name: 'iPhone 15',
            price: 19990000
        });
        expect(mockCartInstance.save).toHaveBeenCalled();
    });

    it('should add quantity to existing item when product already in cart', async () => {
        const mockExistingCart = {
            userId: 'user-1',
            items: [{ productId: { toString: () => 'prod-1' }, quantity: 3, price: 19990000 }],
            save: jest.fn().mockResolvedValue(true)
        };
        Cart.findOne.mockResolvedValue(mockExistingCart);

        const mockProduct = { _id: 'prod-1', name: 'iPhone 15', price: 19990000, isActive: true };
        Product.findById.mockResolvedValue(mockProduct);

        const guestItems = [{ productId: 'prod-1', quantity: 1 }];

        await mergeGuestCart('user-1', guestItems);

        expect(mockExistingCart.items[0].quantity).toBe(4);
        expect(mockExistingCart.save).toHaveBeenCalled();
    });

    it('should skip guest items with invalid/missing productId or quantity', async () => {
        const mockCart = {
            userId: 'user-1',
            items: [],
            save: jest.fn().mockResolvedValue(true)
        };
        Cart.findOne.mockResolvedValue(mockCart);

        const guestItems = [
            { productId: null, quantity: 1 },
            { productId: 'prod-2', quantity: 0 },
        ];

        await mergeGuestCart('user-1', guestItems);

        expect(Product.findById).not.toHaveBeenCalled();
        expect(mockCart.items).toHaveLength(0);
    });

    it('should skip products that are inactive or not found in DB', async () => {
        const mockCart = {
            userId: 'user-1',
            items: [],
            save: jest.fn().mockResolvedValue(true)
        };
        Cart.findOne.mockResolvedValue(mockCart);
        Product.findById
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ _id: 'prod-2', isActive: false });

        const guestItems = [
            { productId: 'prod-missing', quantity: 1 },
            { productId: 'prod-2', quantity: 2 },
        ];

        await mergeGuestCart('user-1', guestItems);

        expect(mockCart.items).toHaveLength(0);
    });

    it('should merge multiple valid guest items into cart', async () => {
        const mockCart = {
            userId: 'user-1',
            items: [],
            save: jest.fn().mockResolvedValue(true)
        };
        Cart.findOne.mockResolvedValue(mockCart);

        Product.findById
            .mockResolvedValueOnce({ _id: 'prod-A', name: 'MacBook', price: 30000000, isActive: true })
            .mockResolvedValueOnce({ _id: 'prod-B', name: 'AirPods', price: 3990000, isActive: true });

        const guestItems = [
            { productId: 'prod-A', quantity: 1 },
            { productId: 'prod-B', quantity: 2 },
        ];

        await mergeGuestCart('user-1', guestItems);

        expect(mockCart.items).toHaveLength(2);
        expect(mockCart.items[0].name).toBe('MacBook');
        expect(mockCart.items[1].name).toBe('AirPods');
        expect(mockCart.items[1].quantity).toBe(2);
    });
});
