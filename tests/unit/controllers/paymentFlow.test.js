/**
 * Payment Acceptance Test Suite
 * ----------------------------------------------------
 * Kiểm thử nghiệm thu cho 2 phương thức thanh toán:
 *   1. COD  - Thanh toán khi giao hàng (ship)
 *   2. VNPay - Cổng thanh toán điện tử
 *
 * Mỗi luồng cần kiểm thử:
 *   - Tạo đơn thành công  (createOrder)
 *   - Cập nhật trạng thái thanh toán  (vnpayIpn / finalizeSuccessfulOrder)
 *   - Trả kết quả về cho khách (vnpayReturn / response COD)
 */

const { createOrder } = require('../../../src/controllers/orderController');
const paymentController = require('../../../src/controllers/paymentController');
const prisma = require('../../../src/config/postgres');
const Product = require('../../../src/models/Product');
const Cart = require('../../../src/models/Cart');
const vnpayService = require('../../../src/services/vnpayService');

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
        update: jest.fn(),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
    }
}));

jest.mock('../../../src/models/Product');
jest.mock('../../../src/models/Cart', () => ({
    findOneAndUpdate: jest.fn().mockResolvedValue({})
}));
jest.mock('../../../src/services/vnpayService');

const VNP_PAYMENT_URL =
    'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=ORDER-001';

describe('💳 PAYMENT ACCEPTANCE TEST — Tính năng thanh toán', () => {
    let req, res;

    beforeEach(() => {
        jest.clearAllMocks();
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            redirect: jest.fn(),
        };
    });

    // ============================================================
    // [TC-COD] Thanh toán khi nhận hàng (Ship COD)
    // ============================================================
    describe('🚚 [TC-COD] Thanh toán khi nhận hàng (Ship COD)', () => {
        beforeEach(() => {
            req = {
                headers: {},
                body: {
                    recipientName: 'Nguyen Van A',
                    recipientPhone: '0901234567',
                    recipientAddress: '123 Le Loi, Q1, HCM',
                    recipientNotes: 'Giao gio hanh chinh',
                    paymentMethod: 'COD',
                    guestEmail: 'khachhang@example.com',
                    items: [{ productId: 'ip4', qty: 1 }] // iPhone 15 - 19.990.000đ
                }
            };
        });

        test('TC-COD-01: Tạo đơn COD thành công → status=Confirmed, paymentUrl=null', async () => {
            const mockOrder = {
                id: 'COD-ORDER-001',
                userId: null,
                finalAmount: 19990000,
                paymentMethod: 'COD',
                status: 'Confirmed',
                paymentStatus: 'Pending',
                items: [{ productId: 'ip4', qty: 1, price: 19990000 }]
            };
            prisma.order.create.mockResolvedValue(mockOrder);

            await createOrder(req, res);

            // ✅ Đơn được tạo với phương thức COD
            expect(prisma.order.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        paymentMethod: 'COD',
                        status: 'Confirmed',     // COD xác nhận ngay
                        paymentStatus: 'Pending', // chờ shipper thu tiền
                        finalAmount: 19990000,
                        subtotal: 19990000,
                        guestEmail: 'khachhang@example.com',
                    })
                })
            );

            // ✅ KHÔNG gọi VNPay
            expect(vnpayService.createPaymentUrl).not.toHaveBeenCalled();

            // ✅ Trả 201 + paymentUrl = null
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Order placed successfully',
                order: mockOrder,
                paymentUrl: null,
                paymentInfo: null
            });
        });

        test('TC-COD-02: Đơn COD nhiều sản phẩm — cộng đúng tổng tiền', async () => {
            req.body.items = [
                { productId: 'ip4', qty: 2 },  // 19.990.000 x 2 = 39.980.000
                { productId: 'w3', qty: 1 },   // Apple Watch SE = 6.290.000
            ];
            // Tổng = 46.270.000đ

            prisma.order.create.mockResolvedValue({
                id: 'COD-ORDER-002',
                finalAmount: 46270000,
                items: []
            });

            await createOrder(req, res);

            expect(prisma.order.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        subtotal: 46270000,
                        finalAmount: 46270000,
                        paymentMethod: 'COD',
                    })
                })
            );
            expect(res.status).toHaveBeenCalledWith(201);
        });

        test('TC-COD-03: Thiếu địa chỉ nhận hàng → 400', async () => {
            delete req.body.recipientAddress;

            await createOrder(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringContaining('required')
                })
            );
            expect(prisma.order.create).not.toHaveBeenCalled();
        });

        test('TC-COD-04: Guest không nhập email → 400', async () => {
            delete req.body.guestEmail;

            await createOrder(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Email is required for guest checkout'
            });
        });
    });

    // ============================================================
    // [TC-VNPAY] Thanh toán qua VNPay
    // ============================================================
    describe('💳 [TC-VNPAY] Thanh toán qua cổng VNPay', () => {
        beforeEach(() => {
            req = {
                headers: { 'x-forwarded-for': '127.0.0.1' },
                connection: { remoteAddress: '127.0.0.1' },
                socket: { remoteAddress: '127.0.0.1' },
                body: {
                    recipientName: 'Tran Thi B',
                    recipientPhone: '0912345678',
                    recipientAddress: '45 Nguyen Trai, Q5, HCM',
                    paymentMethod: 'VNPay',
                    guestEmail: 'vnpay@example.com',
                    items: [{ productId: 'ip1', qty: 1 }] // iPhone 16 Pro Max - 34.990.000đ
                }
            };
        });

        test('TC-VNPAY-01: Tạo đơn VNPay → status=Pending + trả về paymentUrl', async () => {
            const mockOrder = {
                id: 'VNPAY-ORDER-001',
                finalAmount: 34990000,
                paymentMethod: 'VNPay',
                status: 'Pending',
                paymentStatus: 'Pending',
                items: []
            };
            prisma.order.create.mockResolvedValue(mockOrder);
            vnpayService.createPaymentUrl.mockReturnValue(VNP_PAYMENT_URL);

            await createOrder(req, res);

            // ✅ Đơn ở trạng thái Pending — chờ IPN từ VNPay
            expect(prisma.order.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        paymentMethod: 'VNPay',
                        status: 'Pending',
                        paymentStatus: 'Pending',
                        finalAmount: 34990000,
                    })
                })
            );

            // ✅ VNPay được gọi với số tiền đúng
            expect(vnpayService.createPaymentUrl).toHaveBeenCalledWith(
                req,
                'VNPAY-ORDER-001',
                34990000,
                expect.stringContaining('vnpay_return')
            );

            // ✅ Trả paymentUrl cho client redirect
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Order placed successfully',
                order: mockOrder,
                paymentUrl: VNP_PAYMENT_URL,
                paymentInfo: null
            });
        });

        test('TC-VNPAY-02: IPN với chữ ký hợp lệ + responseCode=00 → cập nhật Paid', async () => {
            const orderId = 'VNPAY-ORDER-001';
            const ipnReq = {
                query: {
                    vnp_TxnRef: orderId,
                    vnp_ResponseCode: '00',
                    vnp_TransactionNo: '14567890',
                    vnp_Amount: '3499000000', // 34.990.000 * 100
                    vnp_SecureHash: 'fake-valid-hash'
                }
            };

            vnpayService.verifySignature.mockReturnValue(true);
            prisma.order.findUnique.mockResolvedValue({
                id: orderId,
                finalAmount: 34990000,
                paymentStatus: 'Pending',
                userId: null,
                items: []
            });
            prisma.order.updateMany.mockResolvedValue({ count: 1 });

            await paymentController.vnpayIpn(ipnReq, res);

            // ✅ Đơn được cập nhật Paid + Confirmed (atomic)
            expect(prisma.order.updateMany).toHaveBeenCalledWith({
                where: { id: orderId, paymentStatus: { not: 'Paid' } },
                data: {
                    paymentStatus: 'Paid',
                    transactionId: '14567890',
                    status: 'Confirmed'
                }
            });

            // ✅ Trả VNPay mã thành công
            expect(res.json).toHaveBeenCalledWith({
                RspCode: '00',
                Message: 'Confirm Success'
            });
        });

        test('TC-VNPAY-03: IPN với chữ ký sai → trả RspCode=97', async () => {
            vnpayService.verifySignature.mockReturnValue(false);

            const ipnReq = {
                query: {
                    vnp_TxnRef: 'X',
                    vnp_ResponseCode: '00',
                    vnp_SecureHash: 'tampered'
                }
            };

            await paymentController.vnpayIpn(ipnReq, res);

            expect(res.json).toHaveBeenCalledWith({
                RspCode: '97',
                Message: 'Invalid signature'
            });
            expect(prisma.order.updateMany).not.toHaveBeenCalled();
        });

        test('TC-VNPAY-04: IPN với số tiền bị giả mạo → RspCode=04', async () => {
            vnpayService.verifySignature.mockReturnValue(true);
            prisma.order.findUnique.mockResolvedValue({
                id: 'VNPAY-ORDER-001',
                finalAmount: 34990000,
                paymentStatus: 'Pending',
                items: []
            });

            const ipnReq = {
                query: {
                    vnp_TxnRef: 'VNPAY-ORDER-001',
                    vnp_ResponseCode: '00',
                    vnp_TransactionNo: '111',
                    vnp_Amount: '100000', // sai (1.000đ thay vì 34.990.000đ)
                    vnp_SecureHash: 'h'
                }
            };

            await paymentController.vnpayIpn(ipnReq, res);

            expect(res.json).toHaveBeenCalledWith({
                RspCode: '04',
                Message: 'Invalid amount'
            });
        });

        test('TC-VNPAY-05: IPN responseCode != 00 → cập nhật Failed + hoàn kho', async () => {
            vnpayService.verifySignature.mockReturnValue(true);
            prisma.order.findUnique.mockResolvedValue({
                id: 'VNPAY-ORDER-001',
                finalAmount: 34990000,
                paymentStatus: 'Pending',
                userId: null,
                items: [
                    { productId: '507f1f77bcf86cd799439011', qty: 1 }
                ]
            });
            prisma.order.update.mockResolvedValue({});
            Product.updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });

            const ipnReq = {
                query: {
                    vnp_TxnRef: 'VNPAY-ORDER-001',
                    vnp_ResponseCode: '24', // khach huy
                    vnp_TransactionNo: '111',
                    vnp_Amount: '3499000000',
                    vnp_SecureHash: 'h'
                }
            };

            await paymentController.vnpayIpn(ipnReq, res);

            expect(prisma.order.update).toHaveBeenCalledWith({
                where: { id: 'VNPAY-ORDER-001' },
                data: { paymentStatus: 'Failed', status: 'Failed' }
            });
            expect(res.json).toHaveBeenCalledWith({
                RspCode: '00',
                Message: 'Payment failure recorded'
            });
        });

        test('TC-VNPAY-06: vnpayReturn (browser redirect) → redirect success page', async () => {
            const returnReq = {
                query: {
                    vnp_TxnRef: 'VNPAY-ORDER-001',
                    vnp_ResponseCode: '00',
                    vnp_SecureHash: 'h'
                }
            };

            vnpayService.verifySignature.mockReturnValue(true);
            prisma.order.updateMany.mockResolvedValue({ count: 0 }); // đã confirmed bởi IPN
            prisma.order.findUnique.mockResolvedValue(null);

            await paymentController.vnpayReturn(returnReq, res);

            expect(res.redirect).toHaveBeenCalledWith(
                expect.stringContaining('status=success&orderId=VNPAY-ORDER-001')
            );
        });

        test('TC-VNPAY-07: vnpayReturn chữ ký sai → redirect invalid page', async () => {
            vnpayService.verifySignature.mockReturnValue(false);

            await paymentController.vnpayReturn(
                { query: { vnp_SecureHash: 'bad' } },
                res
            );

            expect(res.redirect).toHaveBeenCalledWith(
                expect.stringContaining('status=invalid')
            );
        });
    });

    // ============================================================
    // [TC-INTEGRATION] Kịch bản nghiệm thu đầu-cuối
    // ============================================================
    describe('🔗 [TC-E2E] Kịch bản nghiệm thu đầu-cuối', () => {
        test('TC-E2E-01: COD — guest đặt đơn → server xác nhận ngay', async () => {
            const guestReq = {
                headers: {},
                body: {
                    recipientName: 'Le Van C',
                    recipientPhone: '0987654321',
                    recipientAddress: '78 Ham Nghi',
                    paymentMethod: 'COD',
                    guestEmail: 'levanc@example.com',
                    items: [{ productId: 'ip8', qty: 1 }] // iPhone SE 3 = 10.990.000
                }
            };
            prisma.order.create.mockResolvedValue({
                id: 'E2E-COD',
                finalAmount: 10990000,
                paymentMethod: 'COD',
                status: 'Confirmed',
                paymentStatus: 'Pending',
                items: []
            });

            await createOrder(guestReq, res);

            expect(res.status).toHaveBeenCalledWith(201);
            const payload = res.json.mock.calls[0][0];
            expect(payload.message).toBe('Order placed successfully');
            expect(payload.paymentUrl).toBeNull();
            expect(payload.order.status).toBe('Confirmed');
        });

        test('TC-E2E-02: VNPay — tạo đơn → IPN xác nhận → trạng thái Paid', async () => {
            // BƯỚC 1: Tạo đơn VNPay
            const createReq = {
                headers: {},
                body: {
                    recipientName: 'Pham Thi D',
                    recipientPhone: '0900000000',
                    recipientAddress: 'Ha Noi',
                    paymentMethod: 'VNPay',
                    guestEmail: 'phamd@example.com',
                    items: [{ productId: 'w3', qty: 1 }] // Watch SE = 6.290.000
                }
            };
            const createdOrder = {
                id: 'E2E-VNPAY',
                finalAmount: 6290000,
                paymentMethod: 'VNPay',
                status: 'Pending',
                paymentStatus: 'Pending',
                items: []
            };
            prisma.order.create.mockResolvedValue(createdOrder);
            vnpayService.createPaymentUrl.mockReturnValue(VNP_PAYMENT_URL);

            await createOrder(createReq, res);

            expect(res.status).toHaveBeenCalledWith(201);
            const createPayload = res.json.mock.calls[0][0];
            expect(createPayload.paymentUrl).toBe(VNP_PAYMENT_URL);
            expect(createPayload.order.status).toBe('Pending');

            // BƯỚC 2: VNPay gửi IPN xác nhận thành công
            const ipnRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            vnpayService.verifySignature.mockReturnValue(true);
            prisma.order.findUnique.mockResolvedValue({
                ...createdOrder,
                userId: null,
            });
            prisma.order.updateMany.mockResolvedValue({ count: 1 });

            await paymentController.vnpayIpn(
                {
                    query: {
                        vnp_TxnRef: 'E2E-VNPAY',
                        vnp_ResponseCode: '00',
                        vnp_TransactionNo: 'TXN-999',
                        vnp_Amount: '629000000',
                        vnp_SecureHash: 'h'
                    }
                },
                ipnRes
            );

            expect(prisma.order.updateMany).toHaveBeenCalledWith({
                where: { id: 'E2E-VNPAY', paymentStatus: { not: 'Paid' } },
                data: {
                    paymentStatus: 'Paid',
                    transactionId: 'TXN-999',
                    status: 'Confirmed'
                }
            });
            expect(ipnRes.json).toHaveBeenCalledWith({
                RspCode: '00',
                Message: 'Confirm Success'
            });
        });
    });
});
