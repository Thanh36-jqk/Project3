const voucherController = require('../../../src/controllers/voucherController');
const Voucher = require('../../../src/models/Voucher');
const prisma = require('../../../src/config/postgres');

jest.mock('../../../src/models/Voucher');
jest.mock('../../../src/config/postgres', () => {
    const user = { findUnique: jest.fn(), update: jest.fn() };
    const voucher = { findFirst: jest.fn(), create: jest.fn() };
    return {
        user,
        voucher,
        $transaction: jest.fn(async (fn) => fn({ user, voucher }))
    };
});

describe('Voucher Controller', () => {
    let req, res;

    beforeEach(() => {
        req = { user: { id: 'user-1' }, body: {}, params: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        jest.clearAllMocks();
    });

    describe('getAvailableVouchers', () => {
        it('should return active, non-expired vouchers with quantity > 0', async () => {
            const mockVouchers = [
                { _id: 'v1', code: 'SAVE10', discountAmount: 10000, isActive: true, quantity: 5 }
            ];
            Voucher.find.mockResolvedValue(mockVouchers);

            await voucherController.getAvailableVouchers(req, res);

            expect(Voucher.find).toHaveBeenCalledWith(expect.objectContaining({
                isActive: true,
                quantity: { $gt: 0 },
            }));
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(mockVouchers);
        });
    });

    describe('redeemVoucher', () => {
        it('should redeem a voucher successfully', async () => {
            req.body = { voucherId: 'v1' };

            const mockUser = { id: 'user-1', points: 500 };
            const mockVoucher = {
                _id: 'v1', code: 'SAVE10', discountAmount: 50000,
                isActive: true, quantity: 3, pointsRequired: 200,
                expiresAt: null,
                save: jest.fn().mockResolvedValue(true)
            };

            prisma.user.findUnique.mockResolvedValue(mockUser);
            Voucher.findById.mockResolvedValue(mockVoucher);
            Voucher.findOneAndUpdate.mockResolvedValue({ ...mockVoucher, quantity: 2 });
            prisma.voucher.findFirst.mockResolvedValue(null);
            prisma.user.update.mockResolvedValue({ ...mockUser, points: 300 });
            prisma.voucher.create.mockResolvedValue({});

            await voucherController.redeemVoucher(req, res);

            expect(Voucher.findOneAndUpdate).toHaveBeenCalledWith(
                { _id: 'v1', quantity: { $gt: 0 }, isActive: true },
                { $inc: { quantity: -1, usageCount: 1 } },
                { new: true }
            );
            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: 'user-1' },
                data: { points: { decrement: 200 } }
            });
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Voucher redeemed successfully',
                points: 300,
                voucher: { code: 'SAVE10', discountAmount: 50000 }
            }));
        });

        it('should return 400 if voucher is not available', async () => {
            req.body = { voucherId: 'v-bad' };
            prisma.user.findUnique.mockResolvedValue({ id: 'user-1', points: 500 });
            Voucher.findById.mockResolvedValue(null);

            await voucherController.redeemVoucher(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ message: 'Voucher not available' });
        });

        it('should return 400 if voucher is inactive', async () => {
            req.body = { voucherId: 'v1' };
            prisma.user.findUnique.mockResolvedValue({ id: 'user-1', points: 500 });
            Voucher.findById.mockResolvedValue({ isActive: false, quantity: 5 });

            await voucherController.redeemVoucher(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 400 if voucher quantity is 0', async () => {
            req.body = { voucherId: 'v1' };
            prisma.user.findUnique.mockResolvedValue({ id: 'user-1', points: 500 });
            Voucher.findById.mockResolvedValue({ isActive: true, quantity: 0 });

            await voucherController.redeemVoucher(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 400 if voucher has expired', async () => {
            req.body = { voucherId: 'v1' };
            prisma.user.findUnique.mockResolvedValue({ id: 'user-1', points: 500 });
            Voucher.findById.mockResolvedValue({
                isActive: true, quantity: 3, pointsRequired: 100,
                expiresAt: new Date(Date.now() - 1000)
            });

            await voucherController.redeemVoucher(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ message: 'Voucher has expired' });
        });

        it('should return 400 if user has insufficient points', async () => {
            req.body = { voucherId: 'v1' };
            prisma.user.findUnique.mockResolvedValue({ id: 'user-1', points: 50 });
            Voucher.findById.mockResolvedValue({
                isActive: true, quantity: 3, pointsRequired: 200, expiresAt: null
            });

            await voucherController.redeemVoucher(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ message: 'Insufficient points' });
        });

        it('should return 400 if voucher already redeemed by user', async () => {
            req.body = { voucherId: 'v1' };
            prisma.user.findUnique.mockResolvedValue({ id: 'user-1', points: 500 });
            Voucher.findById.mockResolvedValue({
                isActive: true, quantity: 3, pointsRequired: 100,
                expiresAt: null, code: 'SAVE10'
            });
            prisma.voucher.findFirst.mockResolvedValue({ id: 'existing-redemption' });

            await voucherController.redeemVoucher(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ message: 'Voucher already redeemed' });
        });

        it('should return 404 if user not found', async () => {
            req.body = { voucherId: 'v1' };
            prisma.user.findUnique.mockResolvedValue(null);

            await voucherController.redeemVoucher(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
        });
    });
});
