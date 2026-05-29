const { createOrder, getOrderById, getUserOrders, finalizeSuccessfulOrder, cancelOrder } = require('../../../src/controllers/orderController');
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
        updateMany: jest.fn(),
    },
    order: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
    }
}));
jest.mock('../../../src/services/emailService', () => ({
    sendEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/utils/emailTemplates', () => ({
    buildCancellationEmail: jest.fn().mockReturnValue('<html>cancel</html>'),
    buildOrderConfirmationEmail: jest.fn().mockReturnValue('<html>confirm</html>'),
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
            paymentUrl: 'https://sandbox.vnpayment.vn/test-payment-url',
            paymentInfo: null
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
            paymentUrl: null,
            paymentInfo: null
        });
    });

    it('should return 400 if guest checkout has no email', async () => {
        delete req.body.guestEmail;

        await createOrder(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'Email is required for guest checkout' });
        expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('should return 400 if items array is empty', async () => {
        req.body.items = [];

        await createOrder(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'Order must contain at least one item' });
    });

    it('should return 400 if an item has missing productId', async () => {
        req.body.items = [{ qty: 2 }]; // no productId

        await createOrder(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('valid productId')
        }));
    });

    it('should parse userId from Authorization header for authenticated users', async () => {
        const jwt = require('jsonwebtoken');
        req.headers.authorization = 'Bearer valid-jwt-token';
        req.body.guestEmail = undefined;
        req.body.paymentMethod = 'COD';
        req.body.items = [{ productId: 'ip4', qty: 1 }];

        // Mock jwt.verify to return a userId
        jest.spyOn(jwt, 'verify').mockReturnValue({ id: 'auth-user-id' });

        const mockOrder = { id: 'auth-order', items: [] };
        prisma.order.create.mockResolvedValue(mockOrder);

        await createOrder(req, res);

        // Order should be created with the userId from the token
        expect(prisma.order.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ userId: 'auth-user-id' })
        }));
        expect(res.status).toHaveBeenCalledWith(201);

        jest.spyOn(jwt, 'verify').mockRestore();
    });

    it('should send order confirmation email after successful COD order', async () => {
        req.body.paymentMethod = 'COD';
        req.body.items = [{ productId: 'ip4', qty: 1 }];

        const mockOrder = { id: 'o1', items: [], recipientName: 'Test User', finalAmount: 19990000, paymentMethod: 'COD', status: 'Confirmed', userId: null };
        prisma.order.create.mockResolvedValue(mockOrder);
        prisma.user.update.mockResolvedValue({ rank: 'Silver', totalSpending: 19990000 });

        const emailService = require('../../../src/services/emailService');

        await createOrder(req, res);

        expect(emailService.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
            to: 'guest@example.com',
            subject: expect.stringContaining('Xác nhận đơn hàng'),
        }));
        expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should include color variant in order items when provided', async () => {
        req.body.items = [{ productId: '507f1f77bcf86cd799439011', qty: 1, color: 'Midnight' }];
        req.body.paymentMethod = 'COD';

        Product.updateOne.mockResolvedValue({ modifiedCount: 1 });
        Product.findById.mockResolvedValue({ _id: '507f1f77bcf86cd799439011', name: 'iPhone 15', price: 20000000 });
        const mockOrder = { id: 'color-order', items: [] };
        prisma.order.create.mockResolvedValue(mockOrder);
        prisma.user.update.mockResolvedValue({ rank: 'Silver', totalSpending: 20000000 });

        await createOrder(req, res);

        expect(prisma.order.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                items: {
                    create: expect.arrayContaining([
                        expect.objectContaining({ color: 'Midnight' })
                    ])
                }
            })
        }));
        expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should apply voucher discount when appliedVoucher is provided by authenticated user', async () => {
        req.headers.authorization = 'Bearer valid-jwt';
        req.body = {
            recipientName: 'Nguyen A', recipientPhone: '0900000000',
            recipientAddress: '123 Main St', paymentMethod: 'COD',
            items: [{ productId: 'ip4', qty: 1 }],
            appliedVoucher: 'SAVE50K'
        };

        const jwt = require('jsonwebtoken');
        jest.spyOn(jwt, 'verify').mockReturnValue({ id: 'user-with-voucher' });

        const mockVoucher = { id: 'v1', code: 'SAVE50K', discountAmount: 50000, isUsed: false };
        prisma.voucher.findFirst.mockResolvedValue(mockVoucher);
        prisma.voucher.update.mockResolvedValue({});

        const mockOrder = { id: 'voucher-order', items: [] };
        prisma.order.create.mockResolvedValue(mockOrder);

        await createOrder(req, res);

        expect(prisma.voucher.update).toHaveBeenCalledWith({
            where: { id: 'v1' }, data: { isUsed: true }
        });
        expect(prisma.order.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                discountAmount: 50000,
                appliedVoucher: 'SAVE50K',
                finalAmount: 19990000 - 50000
            })
        }));

        jest.spyOn(jwt, 'verify').mockRestore();
    });

    it('should auto-register guest account when createAccount=true with email+password', async () => {
        req.body = {
            recipientName: 'New User', recipientPhone: '0912345678',
            recipientAddress: '456 Side St', paymentMethod: 'COD',
            items: [{ productId: 'ip4', qty: 1 }],
            guestEmail: 'newguest@example.com',
            createAccount: true,
            guestPassword: 'securePass123'
        };

        const bcrypt = require('bcrypt');
        jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashedGuestPass');
        prisma.user.findUnique.mockResolvedValue(null);
        prisma.user.create.mockResolvedValue({ id: 'new-guest-user', email: 'newguest@example.com' });

        const mockOrder = { id: 'auto-reg-order', items: [] };
        prisma.order.create.mockResolvedValue(mockOrder);

        await createOrder(req, res);

        expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                email: 'newguest@example.com',
                role: 'user',
                rank: 'Silver'
            })
        }));
        expect(prisma.order.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ userId: 'new-guest-user' })
        }));
        expect(res.status).toHaveBeenCalledWith(201);

        jest.spyOn(bcrypt, 'hash').mockRestore();
    });
});

describe('Order Controller - getOrderById (error case)', () => {
    it('should return 500 on unexpected DB error', async () => {
        const req = { params: { id: 'any' } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        prisma.order.findUnique.mockRejectedValue(new Error('Connection timeout'));

        await getOrderById(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe('Order Controller - getOrderById', () => {
    let req, res;

    beforeEach(() => {
        req = { params: { id: 'order-123' } };
        res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        jest.clearAllMocks();
    });

    it('should return order with items if found', async () => {
        const mockOrder = { id: 'order-123', userId: null, status: 'Confirmed', items: [{ qty: 1, price: 5000000 }] };
        prisma.order.findUnique.mockResolvedValue(mockOrder);

        await getOrderById(req, res);

        expect(prisma.order.findUnique).toHaveBeenCalledWith({ where: { id: 'order-123' }, include: { items: true } });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(mockOrder);
    });

    it('should return 404 if order not found', async () => {
        prisma.order.findUnique.mockResolvedValue(null);

        await getOrderById(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ message: 'Order not found. Please check your Order ID.' });
    });

    it('should return 200 if authenticated user accesses their own order', async () => {
        req.user = { id: 'user-A' };
        prisma.order.findUnique.mockResolvedValue({ id: 'order-123', userId: 'user-A', items: [] });

        await getOrderById(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 403 if authenticated user tries to access another user\'s order', async () => {
        req.user = { id: 'user-A' };
        prisma.order.findUnique.mockResolvedValue({ id: 'order-123', userId: 'user-B', items: [] });

        await getOrderById(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ message: 'Access denied' });
    });

    it('should return 200 for guest access (no user — UUID is unguessable)', async () => {
        // req has no .user property (unauthenticated)
        prisma.order.findUnique.mockResolvedValue({ id: 'order-123', userId: 'some-user', items: [] });

        await getOrderById(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
    });
});

describe('Order Controller - getUserOrders', () => {
    let req, res;

    beforeEach(() => {
        req = { user: { id: 'user-1' } };
        res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        jest.clearAllMocks();
    });

    it('should return all orders for the authenticated user, newest first', async () => {
        const mockOrders = [
            { id: 'order-2', status: 'Confirmed', createdAt: new Date('2025-06-01'), items: [] },
            { id: 'order-1', status: 'Pending', createdAt: new Date('2025-05-01'), items: [] },
        ];
        prisma.order.findMany.mockResolvedValue(mockOrders);

        await getUserOrders(req, res);

        expect(prisma.order.findMany).toHaveBeenCalledWith({
            where: { userId: 'user-1' },
            orderBy: { createdAt: 'desc' },
            include: { items: true }
        });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(mockOrders);
    });

    it('should return empty array if user has no orders', async () => {
        prisma.order.findMany.mockResolvedValue([]);

        await getUserOrders(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith([]);
    });

    it('should return 500 on database error', async () => {
        prisma.order.findMany.mockRejectedValue(new Error('DB connection failed'));

        await getUserOrders(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe('finalizeSuccessfulOrder — điểm thưởng & nâng hạng', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        Cart.findOneAndUpdate.mockResolvedValue({});
    });

    it('nên bỏ qua nếu không có userId (guest order)', async () => {
        await finalizeSuccessfulOrder({ userId: null, finalAmount: 5000000 });

        expect(Cart.findOneAndUpdate).not.toHaveBeenCalled();
        expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('nên xóa giỏ hàng sau khi đặt hàng thành công', async () => {
        prisma.user.update.mockResolvedValue({ rank: 'Silver', totalSpending: 5000000 });

        await finalizeSuccessfulOrder({ userId: 'user-1', finalAmount: 5000000 });

        expect(Cart.findOneAndUpdate).toHaveBeenCalledWith(
            { userId: 'user-1' },
            { $set: { items: [] } }
        );
    });

    it('nên cộng đúng số điểm: floor(finalAmount / 100000)', async () => {
        // 3.500.000đ → 35 điểm
        prisma.user.update.mockResolvedValue({ rank: 'Silver', totalSpending: 3500000 });

        await finalizeSuccessfulOrder({ userId: 'user-1', finalAmount: 3500000 });

        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: 'user-1' },
            data: {
                points: { increment: 35 },
                totalSpending: { increment: 3500000 }
            }
        });
    });

    it('không nâng hạng nếu tổng chi tiêu chưa đạt ngưỡng', async () => {
        // totalSpending = 15.000.000 < 20.000.000 → vẫn Silver
        prisma.user.update.mockResolvedValue({ rank: 'Silver', totalSpending: 15000000 });

        await finalizeSuccessfulOrder({ userId: 'user-1', finalAmount: 5000000 });

        // user.update chỉ được gọi 1 lần (không có lần nâng hạng)
        expect(prisma.user.update).toHaveBeenCalledTimes(1);
    });

    it('nên nâng hạng Silver → Gold khi tổng chi tiêu vượt 20.000.000đ', async () => {
        // Sau đơn này totalSpending = 25.000.000 → Gold
        prisma.user.update.mockResolvedValue({ rank: 'Silver', totalSpending: 25000000 });

        await finalizeSuccessfulOrder({ userId: 'user-1', finalAmount: 5000000 });

        expect(prisma.user.update).toHaveBeenCalledTimes(2);
        expect(prisma.user.update).toHaveBeenLastCalledWith({
            where: { id: 'user-1' },
            data: { rank: 'Gold' }
        });
    });

    it('nên nâng hạng Gold → VIP khi tổng chi tiêu vượt 50.000.000đ', async () => {
        // Sau đơn này totalSpending = 55.000.000 → VIP
        prisma.user.update.mockResolvedValue({ rank: 'Gold', totalSpending: 55000000 });

        await finalizeSuccessfulOrder({ userId: 'user-1', finalAmount: 10000000 });

        expect(prisma.user.update).toHaveBeenCalledTimes(2);
        expect(prisma.user.update).toHaveBeenLastCalledWith({
            where: { id: 'user-1' },
            data: { rank: 'VIP' }
        });
    });

    it('nên nâng hạng Silver → VIP trực tiếp nếu đơn đầu tiên vượt 50.000.000đ', async () => {
        // Mua MacBook Pro 65 triệu → thẳng VIP
        prisma.user.update.mockResolvedValue({ rank: 'Silver', totalSpending: 65000000 });

        await finalizeSuccessfulOrder({ userId: 'user-1', finalAmount: 65000000 });

        expect(prisma.user.update).toHaveBeenLastCalledWith({
            where: { id: 'user-1' },
            data: { rank: 'VIP' }
        });
    });

    it('không gọi update hạng nếu hạng đã là VIP', async () => {
        // Đã VIP, mua thêm → không cần update rank
        prisma.user.update.mockResolvedValue({ rank: 'VIP', totalSpending: 100000000 });

        await finalizeSuccessfulOrder({ userId: 'user-1', finalAmount: 5000000 });

        // Chỉ 1 lần update (điểm + spending), không có lần thứ 2 cho rank
        expect(prisma.user.update).toHaveBeenCalledTimes(1);
    });

    it('số điểm làm tròn xuống — phần lẻ dưới 100.000đ không được tính', async () => {
        // 199.999đ → 1 điểm (không phải 2)
        prisma.user.update.mockResolvedValue({ rank: 'Silver', totalSpending: 199999 });

        await finalizeSuccessfulOrder({ userId: 'user-1', finalAmount: 199999 });

        expect(prisma.user.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ points: { increment: 1 } })
            })
        );
    });
});

describe('Order Controller - cancelOrder', () => {
    let req, res;

    beforeEach(() => {
        req = {
            params: { id: 'order-uuid-123' },
            body: { reason: 'Tôi đổi ý' },
            user: { id: 'user-abc' }
        };
        res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        jest.clearAllMocks();
    });

    it('should cancel a Confirmed (COD) order, restore stock and deduct points', async () => {
        const mockOrder = {
            id: 'order-uuid-123',
            userId: 'user-abc',
            status: 'Confirmed',
            paymentMethod: 'COD',
            finalAmount: 5000000,
            appliedVoucher: null,
            items: [{ productId: '507f1f77bcf86cd799439011', qty: 2, price: 2500000, name: 'iPhone' }]
        };
        prisma.order.findUnique.mockResolvedValue(mockOrder);
        prisma.order.update.mockResolvedValue({});
        Product.updateOne.mockResolvedValue({});
        prisma.user.findUnique.mockResolvedValue({ id: 'user-abc', points: 50, totalSpending: 5000000 });
        prisma.user.update.mockResolvedValue({});

        await cancelOrder(req, res);

        expect(prisma.order.update).toHaveBeenCalledWith({
            where: { id: 'order-uuid-123' },
            data: { status: 'Cancelled', cancelReason: 'Tôi đổi ý' }
        });
        expect(Product.updateOne).toHaveBeenCalledWith(
            { _id: '507f1f77bcf86cd799439011' },
            { $inc: { stock: 2 } }
        );
        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: 'user-abc' },
            data: { points: 0, totalSpending: 0 }
        });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ message: 'Đơn hàng đã được hủy thành công' });
    });

    it('should cancel a Pending (VNPay) order without deducting points', async () => {
        const mockOrder = {
            id: 'order-uuid-123',
            userId: 'user-abc',
            status: 'Pending',
            paymentMethod: 'VNPay',
            finalAmount: 10000000,
            appliedVoucher: null,
            items: [{ productId: '507f1f77bcf86cd799439011', qty: 1, price: 10000000 }]
        };
        prisma.order.findUnique.mockResolvedValue(mockOrder);
        prisma.order.update.mockResolvedValue({});
        Product.updateOne.mockResolvedValue({});

        await cancelOrder(req, res);

        expect(prisma.order.update).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ status: 'Cancelled' })
        }));
        // Points not deducted for Pending (not yet finalized) — user.update should not be called
        expect(prisma.user.update).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should restore voucher if one was applied', async () => {
        const mockOrder = {
            id: 'order-uuid-123',
            userId: 'user-abc',
            status: 'Pending',
            paymentMethod: 'VNPay',
            finalAmount: 10000000,
            appliedVoucher: 'SAVE100K',
            items: []
        };
        prisma.order.findUnique.mockResolvedValue(mockOrder);
        prisma.order.update.mockResolvedValue({});
        prisma.voucher.updateMany.mockResolvedValue({});

        await cancelOrder(req, res);

        expect(prisma.voucher.updateMany).toHaveBeenCalledWith({
            where: { userId: 'user-abc', code: 'SAVE100K', isUsed: true },
            data: { isUsed: false }
        });
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 if order not found', async () => {
        prisma.order.findUnique.mockResolvedValue(null);

        await cancelOrder(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ message: 'Không tìm thấy đơn hàng' });
    });

    it('should return 403 if order belongs to a different user', async () => {
        prisma.order.findUnique.mockResolvedValue({
            id: 'order-uuid-123',
            userId: 'other-user',
            status: 'Confirmed',
            items: []
        });

        await cancelOrder(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it('should return 400 if order status is Shipped (not cancellable)', async () => {
        prisma.order.findUnique.mockResolvedValue({
            id: 'order-uuid-123',
            userId: 'user-abc',
            status: 'Shipped',
            items: []
        });

        await cancelOrder(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('Shipped')
        }));
    });
});
