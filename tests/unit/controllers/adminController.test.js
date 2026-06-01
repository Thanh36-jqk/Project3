const adminController = require('../../../src/controllers/adminController');
const Product = require('../../../src/models/Product');
const Voucher = require('../../../src/models/Voucher');
const prisma = require('../../../src/config/postgres');
const emailService = require('../../../src/services/emailService');

jest.mock('../../../src/models/Product');
jest.mock('../../../src/models/Voucher');
jest.mock('../../../src/services/emailService', () => ({ sendEmail: jest.fn() }));
jest.mock('../../../src/config/postgres', () => ({
    order: {
        count: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn(),
    },
    user: {
        count: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
    }
}));

describe('Admin Controller', () => {
    let req, res;

    beforeEach(() => {
        req = { params: {}, body: {}, query: {}, user: { id: 'admin-1', role: 'admin' } };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterAll(() => jest.restoreAllMocks());

    describe('getDashboardStats', () => {
        it('should return dashboard stats', async () => {
            Product.countDocuments.mockResolvedValue(120);
            prisma.order.count.mockResolvedValue(350);
            prisma.user.count.mockResolvedValue(500);
            prisma.order.aggregate.mockResolvedValue({ _sum: { finalAmount: 150000000 } });

            await adminController.getDashboardStats(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                totalProducts: 120,
                totalOrders: 350,
                totalUsers: 500,
                totalRevenue: 150000000
            });
        });

        it('should return 0 revenue if no completed orders', async () => {
            Product.countDocuments.mockResolvedValue(0);
            prisma.order.count.mockResolvedValue(0);
            prisma.user.count.mockResolvedValue(0);
            prisma.order.aggregate.mockResolvedValue({ _sum: { finalAmount: null } });

            await adminController.getDashboardStats(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ totalRevenue: 0 }));
        });
    });

    describe('getAllProducts (Admin)', () => {
        it('should return paginated products with metadata', async () => {
            req.query = { page: '1', limit: '2' };
            const mockProducts = [{ name: 'AirPods' }, { name: 'iPhone' }];
            Product.find.mockReturnValue({
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue(mockProducts)
            });
            Product.countDocuments.mockResolvedValue(10);

            await adminController.getAllProducts(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                data: mockProducts, total: 10, page: 1, pages: 5
            });
        });

        it('should use defaults page=1 limit=20 when no query params', async () => {
            req.query = {};
            Product.find.mockReturnValue({
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([])
            });
            Product.countDocuments.mockResolvedValue(0);

            await adminController.getAllProducts(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pages: 0 }));
        });
    });

    describe('getAllOrders', () => {
        it('should return paginated orders with metadata', async () => {
            req.query = { page: '1', limit: '2' };
            const mockOrders = [{ id: 'o1' }, { id: 'o2' }];
            prisma.order.findMany.mockResolvedValue(mockOrders);
            prisma.order.count.mockResolvedValue(10);

            await adminController.getAllOrders(req, res);

            expect(prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
                skip: 0, take: 2,
                orderBy: { createdAt: 'desc' },
                include: expect.objectContaining({ items: true })
            }));
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                data: mockOrders, total: 10, page: 1, pages: 5
            });
        });

        it('should use defaults page=1 limit=20 when no query params', async () => {
            req.query = {};
            prisma.order.findMany.mockResolvedValue([]);
            prisma.order.count.mockResolvedValue(0);

            await adminController.getAllOrders(req, res);

            expect(prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
                skip: 0, take: 20
            }));
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
        });
    });

    describe('updateOrderStatus', () => {
        it('should update order status and send email notification', async () => {
            req.params.id = 'order-1';
            req.body = { status: 'Shipped' };

            const mockOrder = {
                id: 'order-1',
                status: 'Shipped',
                finalAmount: 25000000,
                recipientName: 'Nguyen Van A',
                guestEmail: null,
                user: { email: 'user@test.com', name: 'Nguyen Van A' }
            };
            prisma.order.update.mockResolvedValue(mockOrder);
            emailService.sendEmail.mockResolvedValue(true);

            await adminController.updateOrderStatus(req, res);

            expect(prisma.order.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'order-1' },
                data: { status: 'Shipped' }
            }));
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(mockOrder);
        });

        it('should return 400 for invalid status', async () => {
            req.params.id = 'order-1';
            req.body = { status: 'InvalidStatus' };

            await adminController.updateOrderStatus(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(prisma.order.update).not.toHaveBeenCalled();
        });

        it('should return 404 if order not found', async () => {
            req.params.id = 'nonexistent';
            req.body = { status: 'Shipped' };

            const prismaError = new Error('Not found');
            prismaError.code = 'P2025';
            prisma.order.update.mockRejectedValue(prismaError);

            await adminController.updateOrderStatus(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ message: 'Order not found' });
        });
    });

    describe('getAllUsers', () => {
        it('should return paginated users with metadata', async () => {
            req.query = { page: '2', limit: '5' };
            const mockUsers = [{ id: 'u1' }];
            prisma.user.findMany.mockResolvedValue(mockUsers);
            prisma.user.count.mockResolvedValue(11);

            await adminController.getAllUsers(req, res);

            expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
                skip: 5, take: 5,
                orderBy: { createdAt: 'desc' }
            }));
            expect(res.json).toHaveBeenCalledWith({
                data: mockUsers, total: 11, page: 2, pages: 3
            });
        });

        it('should return all users with selected fields', async () => {
            req.query = {};
            const mockUsers = [
                { id: 'u1', name: 'Alice', email: 'alice@test.com', role: 'user', rank: 'Gold' }
            ];
            prisma.user.findMany.mockResolvedValue(mockUsers);
            prisma.user.count.mockResolvedValue(1);

            await adminController.getAllUsers(req, res);

            expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
                select: expect.objectContaining({ id: true, email: true, rank: true }),
                orderBy: { createdAt: 'desc' }
            }));
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: mockUsers }));
        });
    });

    describe('updateUserRank', () => {
        it('should update user rank successfully', async () => {
            req.params.id = 'user-1';
            req.body = { rank: 'Gold' };

            const updatedUser = { id: 'user-1', rank: 'Gold', email: 'u@test.com' };
            prisma.user.update.mockResolvedValue(updatedUser);

            await adminController.updateUserRank(req, res);

            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: 'user-1' },
                data: { rank: 'Gold' },
                select: expect.any(Object)
            });
            expect(res.status).toHaveBeenCalledWith(200);
        });

        it('should return 400 for invalid rank', async () => {
            req.params.id = 'user-1';
            req.body = { rank: 'Diamond' };

            await adminController.updateUserRank(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(prisma.user.update).not.toHaveBeenCalled();
        });

        it('should return 404 if user not found', async () => {
            req.params.id = 'nonexistent';
            req.body = { rank: 'VIP' };

            const prismaError = new Error('Not found');
            prismaError.code = 'P2025';
            prisma.user.update.mockRejectedValue(prismaError);

            await adminController.updateUserRank(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });
    });

    describe('Voucher Management', () => {
        it('should return all vouchers', async () => {
            const mockVouchers = [{ code: 'SAVE10', discountAmount: 10000, isActive: true }];
            Voucher.find.mockReturnValue({
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue(mockVouchers)
            });
            Voucher.countDocuments = jest.fn().mockResolvedValue(1);

            await adminController.getAllVouchers(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            const response = res.json.mock.calls[0][0];
            expect(response.data).toEqual(mockVouchers);
            expect(response.total).toBe(1);
        });

        it('should create a voucher successfully', async () => {
            req.body = { code: 'NEW20', discountAmount: 20000, pointsRequired: 100, quantity: 50, isActive: true };

            const savedVoucher = { _id: 'v1', ...req.body };
            const mockVoucherInstance = { save: jest.fn().mockResolvedValue(savedVoucher), ...savedVoucher };
            Voucher.mockImplementation(() => mockVoucherInstance);

            await adminController.createVoucher(req, res);

            expect(mockVoucherInstance.save).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(201);
        });

        it('should return 400 when creating voucher with missing required fields', async () => {
            req.body = { code: 'INCOMPLETE' };

            await adminController.createVoucher(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ message: 'code, discountAmount, and pointsRequired are required' });
        });

        it('should update a voucher', async () => {
            req.params.id = 'v1';
            req.body = { isActive: false, quantity: 0 };

            const updatedVoucher = { _id: 'v1', code: 'SAVE10', isActive: false };
            Voucher.findByIdAndUpdate.mockResolvedValue(updatedVoucher);

            await adminController.updateVoucher(req, res);

            expect(Voucher.findByIdAndUpdate).toHaveBeenCalledWith('v1', { isActive: false, quantity: 0 }, { new: true });
            expect(res.status).toHaveBeenCalledWith(200);
        });

        it('should return 404 if voucher not found on update', async () => {
            req.params.id = 'missing';
            req.body = { isActive: false };
            Voucher.findByIdAndUpdate.mockResolvedValue(null);

            await adminController.updateVoucher(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });

        it('should delete a voucher', async () => {
            req.params.id = 'v1';
            Voucher.findByIdAndDelete.mockResolvedValue({ _id: 'v1', code: 'SAVE10' });

            await adminController.deleteVoucher(req, res);

            expect(Voucher.findByIdAndDelete).toHaveBeenCalledWith('v1');
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ message: 'Voucher deleted successfully' });
        });

        it('should return 404 if voucher not found on delete', async () => {
            req.params.id = 'missing';
            Voucher.findByIdAndDelete.mockResolvedValue(null);

            await adminController.deleteVoucher(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });
    });

    describe('getAuditLogs', () => {
        it('should return audit logs array', () => {
            adminController.getAuditLogs(req, res);
            expect(res.json).toHaveBeenCalledWith(expect.any(Array));
        });
    });
});
