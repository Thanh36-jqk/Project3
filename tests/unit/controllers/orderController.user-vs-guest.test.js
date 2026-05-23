/**
 * Order Controller — Guest vs Authenticated User
 * ------------------------------------------------
 * Kiểm thử hai luồng đặt hàng chính:
 *   A. Người lạ (Guest)  — không có tài khoản / token
 *   B. Người dùng đã đăng ký (Authenticated) — có JWT token
 *
 * Mỗi luồng kiểm tra cả COD lẫn VNPay.
 */

const { createOrder } = require('../../../src/controllers/orderController');
const prisma = require('../../../src/config/postgres');
const Product = require('../../../src/models/Product');
const Cart = require('../../../src/models/Cart');
const vnpayService = require('../../../src/services/vnpayService');
const emailService = require('../../../src/services/emailService');

jest.mock('../../../src/config/postgres', () => ({
    user: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ rank: 'Silver', totalSpending: 0 }),
    },
    voucher: { findFirst: jest.fn() },
    order: { create: jest.fn(), findUnique: jest.fn() },
}));
jest.mock('../../../src/models/Product');
jest.mock('../../../src/models/Cart', () => ({ findOneAndUpdate: jest.fn().mockResolvedValue({}) }));
jest.mock('../../../src/services/vnpayService');
jest.mock('../../../src/services/emailService', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../../src/utils/emailTemplates', () => ({
    buildOrderConfirmationEmail: jest.fn().mockReturnValue('<html>confirm</html>'),
    buildCancellationEmail: jest.fn().mockReturnValue('<html>cancel</html>'),
}));

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
function makeRes() {
    return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

/** Đơn hàng dummy (productId không phải MongoDB ObjectId) — bỏ qua stock deduction */
function baseBody(overrides = {}) {
    return {
        recipientName: 'Test Buyer',
        recipientPhone: '0900000000',
        recipientAddress: '123 Test St',
        paymentMethod: 'COD',
        items: [{ productId: 'ip4', qty: 1 }],  // dummy → price=19.990.000
        ...overrides,
    };
}

/** Đơn hàng MongoDB product — cần mock Product.updateOne + findById */
function realProductBody(overrides = {}) {
    return {
        recipientName: 'Test Buyer',
        recipientPhone: '0900000000',
        recipientAddress: '123 Test St',
        paymentMethod: 'COD',
        items: [{ productId: '507f1f77bcf86cd799439011', qty: 1 }],
        ...overrides,
    };
}

// ────────────────────────────────────────────────────────────
// A. NGƯỜI LẠ (GUEST)
// ────────────────────────────────────────────────────────────
describe('A. Người lạ (Guest) — chưa có tài khoản', () => {
    let res;

    beforeEach(() => {
        res = makeRes();
        jest.clearAllMocks();
        prisma.user.update.mockResolvedValue({ rank: 'Silver', totalSpending: 0 });
    });

    describe('A1. COD', () => {
        it('tạo đơn COD thành công — userId=null, guestEmail được lưu', async () => {
            const req = {
                headers: {},
                body: baseBody({ guestEmail: 'guest@example.com' }),
            };
            const mockOrder = {
                id: 'guest-cod-001', userId: null,
                guestEmail: 'guest@example.com', finalAmount: 19990000,
                status: 'Confirmed', paymentMethod: 'COD', items: []
            };
            prisma.order.create.mockResolvedValue(mockOrder);

            await createOrder(req, res);

            // userId=null — không gắn tài khoản
            expect(prisma.order.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    userId: null,
                    guestEmail: 'guest@example.com',
                    status: 'Confirmed',
                    paymentMethod: 'COD',
                })
            }));
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                paymentUrl: null,
                order: expect.objectContaining({ userId: null }),
            }));
        });

        it('không gọi Cart.findOneAndUpdate — guest không có giỏ hàng server', async () => {
            const req = { headers: {}, body: baseBody({ guestEmail: 'g@x.com' }) };
            prisma.order.create.mockResolvedValue({
                id: 'g2', userId: null, finalAmount: 0, items: []
            });

            await createOrder(req, res);

            expect(Cart.findOneAndUpdate).not.toHaveBeenCalled();
        });

        it('không gọi prisma.user.update — guest không nhận điểm', async () => {
            const req = { headers: {}, body: baseBody({ guestEmail: 'g@x.com' }) };
            prisma.order.create.mockResolvedValue({
                id: 'g3', userId: null, finalAmount: 19990000, items: []
            });

            await createOrder(req, res);

            expect(prisma.user.update).not.toHaveBeenCalled();
        });

        it('gửi email xác nhận tới guestEmail', async () => {
            const req = { headers: {}, body: baseBody({ guestEmail: 'guest@example.com' }) };
            prisma.order.create.mockResolvedValue({
                id: 'g4', userId: null, finalAmount: 19990000, items: [],
                recipientName: 'Test Buyer', paymentMethod: 'COD', status: 'Confirmed'
            });

            await createOrder(req, res);

            expect(emailService.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
                to: 'guest@example.com',
                subject: expect.stringContaining('Xác nhận đơn hàng'),
            }));
        });

        it('trả 400 nếu thiếu guestEmail', async () => {
            const req = { headers: {}, body: baseBody() }; // không có guestEmail

            await createOrder(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ message: 'Email is required for guest checkout' });
            expect(prisma.order.create).not.toHaveBeenCalled();
        });

        it('token "Bearer null" (checkout.html cũ) → vẫn xử lý như guest, không crash', async () => {
            // checkout.html từng gửi 'Bearer null' cho guest — phải chịu được
            const req = {
                headers: { token: 'Bearer null' },
                body: baseBody({ guestEmail: 'guest@example.com' }),
            };
            prisma.order.create.mockResolvedValue({
                id: 'null-token-order', userId: null, finalAmount: 19990000, items: []
            });

            await createOrder(req, res);

            // JWT verify "null" sẽ fail → userId giữ nguyên null → tạo đơn như guest
            expect(prisma.order.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ userId: null }),
            }));
            expect(res.status).toHaveBeenCalledWith(201);
        });

        it('token hết hạn → vẫn xử lý như guest, không trả 401', async () => {
            const req = {
                headers: { authorization: 'Bearer expired.jwt.token' },
                body: baseBody({ guestEmail: 'expired@example.com' }),
            };
            prisma.order.create.mockResolvedValue({
                id: 'exp-token-order', userId: null, finalAmount: 19990000, items: []
            });

            await createOrder(req, res);

            // JWT verify fail → guest, không block request
            expect(prisma.order.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ userId: null }),
            }));
            expect(res.status).toHaveBeenCalledWith(201);
        });
    });

    describe('A2. VNPay', () => {
        it('tạo đơn VNPay — userId=null, status=Pending, trả paymentUrl', async () => {
            const req = {
                headers: {},
                body: baseBody({ paymentMethod: 'VNPay', guestEmail: 'guest@example.com' }),
            };
            const mockOrder = {
                id: 'guest-vnpay-001', userId: null,
                finalAmount: 19990000, status: 'Pending',
                paymentMethod: 'VNPay', items: []
            };
            prisma.order.create.mockResolvedValue(mockOrder);
            vnpayService.createPaymentUrl.mockReturnValue('https://sandbox.vnpayment.vn/pay?ref=guest-vnpay-001');

            await createOrder(req, res);

            expect(prisma.order.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    userId: null,
                    status: 'Pending',
                    paymentMethod: 'VNPay',
                })
            }));
            // Không finalize ngay (VNPay chờ IPN)
            expect(Cart.findOneAndUpdate).not.toHaveBeenCalled();
            expect(prisma.user.update).not.toHaveBeenCalled();

            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                paymentUrl: 'https://sandbox.vnpayment.vn/pay?ref=guest-vnpay-001',
                order: expect.objectContaining({ status: 'Pending' }),
            }));
        });

        it('email xác nhận gửi tới guestEmail ngay sau khi tạo đơn VNPay', async () => {
            const req = {
                headers: {},
                body: baseBody({ paymentMethod: 'VNPay', guestEmail: 'vnpay-guest@example.com' }),
            };
            prisma.order.create.mockResolvedValue({
                id: 'gvnpay', userId: null, finalAmount: 19990000, items: []
            });
            vnpayService.createPaymentUrl.mockReturnValue('https://sandbox.vnpayment.vn/pay');

            await createOrder(req, res);

            expect(emailService.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
                to: 'vnpay-guest@example.com',
            }));
        });
    });
});

// ────────────────────────────────────────────────────────────
// B. NGƯỜI DÙNG ĐÃ ĐĂNG KÝ (AUTHENTICATED)
// ────────────────────────────────────────────────────────────
describe('B. Người dùng đã đăng ký (Authenticated)', () => {
    let res;
    const jwt = require('jsonwebtoken');

    beforeEach(() => {
        res = makeRes();
        jest.clearAllMocks();
        prisma.user.update.mockResolvedValue({ rank: 'Silver', totalSpending: 0 });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('B1. COD', () => {
        it('tạo đơn COD — userId từ token, guestEmail=null, status=Confirmed', async () => {
            jest.spyOn(jwt, 'verify').mockReturnValue({ id: 'user-001' });
            const req = {
                headers: { authorization: 'Bearer valid.jwt.token' },
                body: baseBody(), // không cần guestEmail khi đã đăng nhập
            };
            const mockOrder = {
                id: 'auth-cod-001', userId: 'user-001',
                finalAmount: 19990000, status: 'Confirmed',
                paymentMethod: 'COD', guestEmail: null, items: []
            };
            prisma.order.create.mockResolvedValue(mockOrder);

            await createOrder(req, res);

            expect(prisma.order.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    userId: 'user-001',
                    guestEmail: null,
                    status: 'Confirmed',
                    paymentMethod: 'COD',
                })
            }));
            expect(res.status).toHaveBeenCalledWith(201);
        });

        it('xóa giỏ hàng và cộng điểm sau COD (finalize)', async () => {
            jest.spyOn(jwt, 'verify').mockReturnValue({ id: 'user-001' });
            const req = {
                headers: { authorization: 'Bearer valid.jwt.token' },
                body: baseBody(),
            };
            prisma.order.create.mockResolvedValue({
                id: 'auth-cod-002', userId: 'user-001',
                finalAmount: 19990000, items: []
            });

            await createOrder(req, res);

            // Giỏ hàng phải được xóa
            expect(Cart.findOneAndUpdate).toHaveBeenCalledWith(
                { userId: 'user-001' },
                { $set: { items: [] } }
            );
            // Điểm được cộng: floor(19.990.000 / 100.000) = 199 điểm
            expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'user-001' },
                data: expect.objectContaining({
                    points: { increment: 199 },
                    totalSpending: { increment: 19990000 },
                })
            }));
        });

        it('email xác nhận gửi tới email của user (lấy từ DB, không phải body)', async () => {
            jest.spyOn(jwt, 'verify').mockReturnValue({ id: 'user-001' });
            const req = {
                headers: { authorization: 'Bearer valid.jwt.token' },
                body: baseBody(),
            };
            prisma.order.create.mockResolvedValue({
                id: 'auth-cod-003', userId: 'user-001', finalAmount: 19990000, items: []
            });
            // Email lấy từ DB, không phải từ request
            prisma.user.findUnique.mockResolvedValue({ email: 'registered@example.com' });

            await createOrder(req, res);

            expect(prisma.user.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: 'user-001' } })
            );
            expect(emailService.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
                to: 'registered@example.com',
            }));
        });

        it('header "token" (thay vì "authorization") cũng parse được userId', async () => {
            jest.spyOn(jwt, 'verify').mockReturnValue({ id: 'user-token-header' });
            const req = {
                headers: { token: 'Bearer valid.jwt.token' }, // dùng header "token"
                body: baseBody(),
            };
            prisma.order.create.mockResolvedValue({
                id: 'token-hdr-order', userId: 'user-token-header', finalAmount: 0, items: []
            });

            await createOrder(req, res);

            expect(prisma.order.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ userId: 'user-token-header' }),
            }));
            expect(res.status).toHaveBeenCalledWith(201);
        });

        it('không cần guestEmail khi đã đăng nhập — tạo đơn thành công', async () => {
            jest.spyOn(jwt, 'verify').mockReturnValue({ id: 'user-001' });
            const req = {
                headers: { authorization: 'Bearer valid.jwt.token' },
                body: baseBody(), // không có guestEmail
            };
            prisma.order.create.mockResolvedValue({
                id: 'no-email-order', userId: 'user-001', finalAmount: 19990000, items: []
            });

            await createOrder(req, res);

            // Không bị chặn bởi validation guestEmail
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).not.toHaveBeenCalledWith(
                expect.objectContaining({ message: 'Email is required for guest checkout' })
            );
        });
    });

    describe('B2. VNPay', () => {
        it('tạo đơn VNPay — userId từ token, status=Pending, không finalize ngay', async () => {
            jest.spyOn(jwt, 'verify').mockReturnValue({ id: 'user-vnpay' });
            const req = {
                headers: { authorization: 'Bearer valid.jwt.token' },
                body: baseBody({ paymentMethod: 'VNPay' }),
            };
            const mockOrder = {
                id: 'auth-vnpay-001', userId: 'user-vnpay',
                finalAmount: 19990000, status: 'Pending',
                paymentMethod: 'VNPay', items: []
            };
            prisma.order.create.mockResolvedValue(mockOrder);
            vnpayService.createPaymentUrl.mockReturnValue('https://sandbox.vnpayment.vn/pay');

            await createOrder(req, res);

            expect(prisma.order.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    userId: 'user-vnpay',
                    status: 'Pending',
                    paymentMethod: 'VNPay',
                })
            }));
            // Chưa finalize — chờ IPN
            expect(Cart.findOneAndUpdate).not.toHaveBeenCalled();
            expect(prisma.user.update).not.toHaveBeenCalled();

            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                paymentUrl: 'https://sandbox.vnpayment.vn/pay',
            }));
        });

        it('VNPay tạo paymentUrl với đúng userId và amount', async () => {
            jest.spyOn(jwt, 'verify').mockReturnValue({ id: 'user-vnpay' });
            const req = {
                headers: { authorization: 'Bearer valid.jwt.token' },
                body: baseBody({ paymentMethod: 'VNPay' }),
            };
            const mockOrder = {
                id: 'auth-vnpay-002', userId: 'user-vnpay',
                finalAmount: 19990000, status: 'Pending', items: []
            };
            prisma.order.create.mockResolvedValue(mockOrder);
            vnpayService.createPaymentUrl.mockReturnValue('https://sandbox.vnpayment.vn/pay');

            await createOrder(req, res);

            expect(vnpayService.createPaymentUrl).toHaveBeenCalledWith(
                req,
                'auth-vnpay-002',
                19990000,
                expect.any(String)
            );
        });

        it('stock bị deduct khi tạo đơn VNPay, hoàn lại nếu DB fail', async () => {
            jest.spyOn(jwt, 'verify').mockReturnValue({ id: 'user-001' });
            Product.updateOne.mockResolvedValueOnce({ modifiedCount: 1 }); // deduct
            Product.updateOne.mockResolvedValueOnce({ modifiedCount: 1 }); // rollback
            Product.findById.mockResolvedValue({
                _id: '507f1f77bcf86cd799439011', name: 'iPhone 15', price: 25000000
            });
            prisma.order.create.mockRejectedValue(new Error('DB timeout'));

            const req = {
                headers: { authorization: 'Bearer valid.jwt.token' },
                body: realProductBody({ paymentMethod: 'VNPay' }),
            };

            await createOrder(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            // Rollback stock
            expect(Product.updateOne).toHaveBeenNthCalledWith(2,
                { _id: '507f1f77bcf86cd799439011' },
                { $inc: { stock: 1 } }
            );
        });
    });

    describe('B3. Ownership — chỉ xem được đơn của mình', () => {
        const { getOrderById } = require('../../../src/controllers/orderController');

        it('trả 200 khi user xem đơn của chính mình', async () => {
            const req = { params: { id: 'ord-1' }, user: { id: 'user-A' } };
            const res2 = makeRes();
            prisma.order.findUnique.mockResolvedValue({
                id: 'ord-1', userId: 'user-A', items: []
            });

            await getOrderById(req, res2);

            expect(res2.status).toHaveBeenCalledWith(200);
        });

        it('trả 403 khi user cố xem đơn của người khác', async () => {
            const req = { params: { id: 'ord-2' }, user: { id: 'user-A' } };
            const res2 = makeRes();
            prisma.order.findUnique.mockResolvedValue({
                id: 'ord-2', userId: 'user-B', items: []
            });

            await getOrderById(req, res2);

            expect(res2.status).toHaveBeenCalledWith(403);
            expect(res2.json).toHaveBeenCalledWith({ message: 'Access denied' });
        });

        it('guest (không có token) có thể xem đơn bằng UUID — UUID không đoán được', async () => {
            const req = { params: { id: 'ord-guest' } }; // req.user = undefined
            const res2 = makeRes();
            prisma.order.findUnique.mockResolvedValue({
                id: 'ord-guest', userId: 'some-user', items: []
            });

            await getOrderById(req, res2);

            expect(res2.status).toHaveBeenCalledWith(200);
        });
    });
});
