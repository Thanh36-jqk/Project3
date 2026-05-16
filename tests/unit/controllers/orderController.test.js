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
        update: jest.fn(),
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
jest.mock('../../../src/models/Cart');
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
                items: [
                    { productId: '507f1f77bcf86cd799439011', qty: 2 }
                ]
            }
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        // Reset all mocks
        jest.clearAllMocks();
    });

    it('should create an order successfully with VNPay and return paymentUrl', async () => {
        // 1. Mock Product Stock Deduction
        Product.updateOne.mockResolvedValue({ modifiedCount: 1 });
        Product.findById.mockResolvedValue({
            _id: '507f1f77bcf86cd799439011',
            name: 'iPhone 15',
            price: 20000000,
            image_url: 'iphone.jpg'
        });

        // 2. Mock Order Creation in Postgres
        const mockOrder = { id: 'order-uuid-123' };
        prisma.order.create.mockResolvedValue(mockOrder);

        // 3. Mock VNPay Service
        vnpayService.createPaymentUrl.mockReturnValue('https://sandbox.vnpayment.vn/test-payment-url');

        // Execute
        await createOrder(req, res);

        // Assertions
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
        // 1. Mock Product Stock Deduction (Success)
        Product.updateOne.mockResolvedValueOnce({ modifiedCount: 1 }); // Deduct
        Product.updateOne.mockResolvedValueOnce({ modifiedCount: 1 }); // Rollback
        Product.findById.mockResolvedValue({
            _id: '507f1f77bcf86cd799439011',
            name: 'iPhone 15',
            price: 20000000
        });

        // 2. Mock Postgres Order Creation (Failure)
        prisma.order.create.mockRejectedValue(new Error('Database Connection Error'));

        // Execute
        await createOrder(req, res);

        // Assertions
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'Database Connection Error' });

        // Verify Compensating Transaction (Rollback)
        expect(Product.updateOne).toHaveBeenCalledTimes(2);
        // Second call should be the rollback
        expect(Product.updateOne).toHaveBeenNthCalledWith(2,
            { _id: '507f1f77bcf86cd799439011' },
            { $inc: { stock: 2 } } // Restoring 2 items
        );
    });

    it('should return 400 if stock deduction fails (Out of Stock)', async () => {
        // Mock Product Stock Deduction (Failure - 0 modified)
        Product.updateOne.mockResolvedValue({ modifiedCount: 0 });

        // Execute
        await createOrder(req, res);

        // Assertions
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('Product stock deduction failed')
        }));

        // Order should not be created
        expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('should create an order successfully with dummy/hardcoded products', async () => {
        // Change request to use a dummy product ID (e.g., ip4)
        req.body.items = [{ productId: 'ip4', qty: 1 }];
        req.body.paymentMethod = 'COD';

        // Mock Order Creation in Postgres
        const mockOrder = { id: 'dummy-order-uuid', items: [] };
        prisma.order.create.mockResolvedValue(mockOrder);

        // Execute
        await createOrder(req, res);

        // Assertions
        // It should NOT call Product.updateOne for dummy products
        expect(Product.updateOne).not.toHaveBeenCalled();

        expect(prisma.order.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                subtotal: 19990000, // Price of ip4 from dummyProducts.js
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
});
