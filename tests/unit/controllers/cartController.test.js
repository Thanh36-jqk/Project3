const { addToCart } = require('../../../src/controllers/cartController');
const Cart = require('../../../src/models/Cart');
const Product = require('../../../src/models/Product');

// Mock dependencies
jest.mock('../../../src/models/Cart');
jest.mock('../../../src/models/Product');

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

        // 1. Mock Product.findById
        Product.findById.mockResolvedValue({
            _id: mongoId,
            name: 'DB Product',
            price: 1000,
            image_url: 'db.jpg'
        });

        // 2. Mock Cart
        const mockCart = {
            items: [],
            save: jest.fn().mockResolvedValue(true)
        };
        Cart.findOne.mockResolvedValue(mockCart);

        // Execute
        await addToCart(req, res);

        // Assertions
        expect(Product.findById).toHaveBeenCalledWith(mongoId);
        expect(mockCart.items[0].name).toBe('DB Product');
        expect(res.status).toHaveBeenCalledWith(200);
    });
});
