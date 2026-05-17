const { createOrder } = require('../../../src/controllers/orderController');
const prisma = require('../../../src/config/postgres');
const Product = require('../../../src/models/Product');
const Cart = require('../../../src/models/Cart');
const vnpayService = require('../../../src/services/vnpayService');

// Mock dependencies
jest.mock('../../../src/config/postgres', () => ({
    user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({ rank: 'Silver', totalSpending: 0 }),
    },
    voucher: {
        findFirst: jest.fn(),
        update: jest.fn(),
    },
    order: {
        create: jest.fn(),
    }
}));

jest.mock('../../../src/models/Product');
jest.mock('../../../src/models/Cart', () => ({
    findOneAndUpdate: jest.fn().mockResolvedValue({})
}));
jest.mock('../../../src/services/vnpayService');

describe('Order Controller - createOrder (Payment Flow)', () => {
    let req, res;

    beforeEach(() => {
        req = {
            headers: {},
            body: {
                recipientName: 'Test User',
                recipientPhone: '0987654321',
                recipientAddress: '123 Test St',
                paymentMethod: 'VNPay',
                guestEmail: 'guest@example.com',
                items: [
                    { productId: '507f1f77bcf86cd799439011', qty: 2 }
                ]
            }
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        jest.clearAllMocks();
    });

    it('should create an order successfully with VNPay and return paymentUrl', async () => {
        Product.updateOne.mockResolvedValue({ modifiedCount: 1 });
        Product.findById.mockResolvedValue({
            _id: '507f1f77bcf86cd799439011',
            name: 'iPhone 15',
            price: 20000000,
            image_url: 'iphone.jpg'
        });

        const mockOrder = { id: 'order-uuid-123', items: [] };
        prisma.order.create.mockResolvedValue(mockOrder);
        vnpayService.createPaymentUrl.mockReturnValue('https://sandbox.vnpayment.vn/test-payment-url');

        await createOrder(req, res);

        expect(Product.updateOne).toHaveBeenCalledWith(
            { _id: '507f1f77bcf86cd799439011', stock: { $gte: 2 } },
            { $inc: { stock: -2 } }
        );

        expect(prisma.order.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                paymentMethod: 'VNPay',
                subtotal: 40000000,
                finalAmount: 40000000,
                status: 'Pending',
            })
        }));

        expect(vnpayService.createPaymentUrl).toHaveBeenCalledWith(
            req,
            'order-uuid-123',
            40000000,
            expect.any(String)
        );

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
            message: 'Order placed successfully',
            order: mockOrder,
            paymentUrl: 'https://sandbox.vnpayment.vn/test-payment-url'
        });
    });

    it('should rollback stock in MongoDB if Postgres order creation fails', async () => {
        Product.updateOne.mockResolvedValueOnce({ modifiedCount: 1 }); // Deduct
        Product.updateOne.mockResolvedValueOnce({ modifiedCount: 1 }); // Rollback
        Product.findById.mockResolvedValue({
            _id: '507f1f77bcf86cd799439011',
            name: 'iPhone 15',
            price: 20000000
        });

        prisma.order.create.mockRejectedValue(new Error('Database Connection Error'));

        await createOrder(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'Database Connection Error' });

        // Compensating transaction (rollback)
        expect(Product.updateOne).toHaveBeenCalledTimes(2);
        expect(Product.updateOne).toHaveBeenNthCalledWith(2,
            { _id: '507f1f77bcf86cd799439011' },
            { $inc: { stock: 2 } }
        );
    });

    it('should return 400 if stock deduction fails (Out of Stock)', async () => {
        Product.updateOne.mockResolvedValue({ modifiedCount: 0 });

        await createOrder(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('Out of stock')
        }));

        expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('should create an order successfully with dummy/hardcoded products', async () => {
        req.body.items = [{ productId: 'ip4', qty: 1 }];
        req.body.paymentMethod = 'COD';

        const mockOrder = { id: 'dummy-order-uuid', items: [] };
        prisma.order.create.mockResolvedValue(mockOrder);

        await createOrder(req, res);

        // Dummy products bypass MongoDB stock deduction
        expect(Product.updateOne).not.toHaveBeenCalled();

        expect(prisma.order.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                subtotal: 19990000,
                finalAmount: 19990000,
                items: {
                    create: expect.arrayContaining([
                        expect.objectContaining({
                            productId: 'ip4',
                            name: 'iPhone 15',
                            price: 19990000
                        })
                    ])
                }
            })
        }));

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
            message: 'Order placed successfully',
            order: mockOrder,
            paymentUrl: null
        });
    });

    it('should return 400 if guest checkout has no email', async () => {
        delete req.body.guestEmail;

        await createOrder(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: 'Email is required for guest checkout'
        });
        expect(prisma.order.create).not.toHaveBeenCalled();
    });
});
