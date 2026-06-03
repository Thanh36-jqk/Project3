const adminAnalyticsController = require('../../../src/controllers/adminAnalyticsController');
const prisma = require('../../../src/config/postgres');

jest.mock('../../../src/config/postgres', () => ({
    order: { findMany: jest.fn(), groupBy: jest.fn() },
    orderItem: { findMany: jest.fn() },
    user: { groupBy: jest.fn() }
}));

describe('Admin Analytics Controller', () => {
    let req, res;

    beforeEach(() => {
        req = { query: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        jest.clearAllMocks();
    });

    describe('getRevenue', () => {
        it('should group revenue by day and fill missing days with 0', async () => {
            req.query = { from: '2026-01-01', to: '2026-01-03', groupBy: 'day' };
            prisma.order.findMany.mockResolvedValue([
                { createdAt: new Date('2026-01-01T10:00:00Z'), finalAmount: 100 },
                { createdAt: new Date('2026-01-01T15:00:00Z'), finalAmount: 50 },
                { createdAt: new Date('2026-01-03T08:00:00Z'), finalAmount: 200 }
            ]);

            await adminAnalyticsController.getRevenue(req, res);

            expect(prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: expect.objectContaining({
                    status: { in: ['Confirmed', 'Completed'] }
                })
            }));
            const { data } = res.json.mock.calls[0][0];
            expect(data).toHaveLength(3);
            expect(data[0].revenue).toBe(150);
            expect(data[1].revenue).toBe(0);
            expect(data[2].revenue).toBe(200);
        });

        it('should default to last 7 days grouped by day when no params given', async () => {
            prisma.order.findMany.mockResolvedValue([]);

            await adminAnalyticsController.getRevenue(req, res);

            const { data } = res.json.mock.calls[0][0];
            expect(data.length).toBeGreaterThanOrEqual(7);
            expect(data.every(d => d.revenue === 0)).toBe(true);
        });

        it('should group revenue by month', async () => {
            req.query = { from: '2026-01-15', to: '2026-03-15', groupBy: 'month' };
            prisma.order.findMany.mockResolvedValue([
                { createdAt: new Date('2026-02-10T10:00:00Z'), finalAmount: 500 }
            ]);

            await adminAnalyticsController.getRevenue(req, res);

            const { data } = res.json.mock.calls[0][0];
            expect(data.map(d => d.date)).toEqual(['2026-01', '2026-02', '2026-03']);
            expect(data[1].revenue).toBe(500);
        });

        it('should group revenue by week (weeks start on Monday)', async () => {
            // 2026-01-05 là thứ Hai
            req.query = { from: '2026-01-05', to: '2026-01-18', groupBy: 'week' };
            prisma.order.findMany.mockResolvedValue([
                { createdAt: new Date('2026-01-07T10:00:00Z'), finalAmount: 300 }, // thứ Tư tuần 1
                { createdAt: new Date('2026-01-11T10:00:00Z'), finalAmount: 100 }  // Chủ nhật tuần 1
            ]);

            await adminAnalyticsController.getRevenue(req, res);

            const { data } = res.json.mock.calls[0][0];
            expect(data).toHaveLength(2);
            expect(data[0].revenue).toBe(400);
            expect(data[1].revenue).toBe(0);
        });

        it('should return 500 on database error', async () => {
            prisma.order.findMany.mockRejectedValue(new Error('DB down'));

            await adminAnalyticsController.getRevenue(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ message: 'DB down' });
        });
    });

    describe('getTopProducts', () => {
        it('should aggregate qty and revenue per product, sorted by qty desc', async () => {
            prisma.orderItem.findMany.mockResolvedValue([
                { name: 'iPhone 15', qty: 2, price: 100, image: 'a.png' },
                { name: 'iPhone 15', qty: 3, price: 100, image: 'a.png' },
                { name: 'iPad Air', qty: 4, price: 50, image: 'b.png' }
            ]);

            await adminAnalyticsController.getTopProducts(req, res);

            const { data } = res.json.mock.calls[0][0];
            expect(data[0]).toEqual({ name: 'iPhone 15', image: 'a.png', qty: 5, revenue: 500 });
            expect(data[1]).toEqual({ name: 'iPad Air', image: 'b.png', qty: 4, revenue: 200 });
        });

        it('should use "Unknown" for items without a name and respect limit', async () => {
            req.query = { limit: '1' };
            prisma.orderItem.findMany.mockResolvedValue([
                { name: null, qty: 10, price: 5, image: null },
                { name: 'AirPods', qty: 1, price: 80, image: 'c.png' }
            ]);

            await adminAnalyticsController.getTopProducts(req, res);

            const { data } = res.json.mock.calls[0][0];
            expect(data).toHaveLength(1);
            expect(data[0].name).toBe('Unknown');
        });

        it('should cap limit at 20', async () => {
            req.query = { limit: '999' };
            prisma.orderItem.findMany.mockResolvedValue(
                Array.from({ length: 30 }, (_, i) => ({ name: `P${i}`, qty: i + 1, price: 10, image: null }))
            );

            await adminAnalyticsController.getTopProducts(req, res);

            const { data } = res.json.mock.calls[0][0];
            expect(data).toHaveLength(20);
        });

        it('should return 500 on database error', async () => {
            prisma.orderItem.findMany.mockRejectedValue(new Error('DB down'));

            await adminAnalyticsController.getTopProducts(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('getOrderFunnel', () => {
        it('should map status groups to counts', async () => {
            prisma.order.groupBy.mockResolvedValue([
                { status: 'Pending', _count: { _all: 3 } },
                { status: 'Completed', _count: { _all: 7 } }
            ]);

            await adminAnalyticsController.getOrderFunnel(req, res);

            expect(res.json).toHaveBeenCalledWith({
                data: [
                    { status: 'Pending', count: 3 },
                    { status: 'Completed', count: 7 }
                ]
            });
        });

        it('should return 500 on database error', async () => {
            prisma.order.groupBy.mockRejectedValue(new Error('DB down'));

            await adminAnalyticsController.getOrderFunnel(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('getUserSegments', () => {
        it('should map rank groups to counts', async () => {
            prisma.user.groupBy.mockResolvedValue([
                { rank: 'Silver', _count: { _all: 10 } },
                { rank: 'VIP', _count: { _all: 2 } }
            ]);

            await adminAnalyticsController.getUserSegments(req, res);

            expect(res.json).toHaveBeenCalledWith({
                data: [
                    { rank: 'Silver', count: 10 },
                    { rank: 'VIP', count: 2 }
                ]
            });
        });

        it('should return 500 on database error', async () => {
            prisma.user.groupBy.mockRejectedValue(new Error('DB down'));

            await adminAnalyticsController.getUserSegments(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('getPaymentMethods', () => {
        it('should map payment method groups with revenue, defaulting null sum to 0', async () => {
            prisma.order.groupBy.mockResolvedValue([
                { paymentMethod: 'COD', _count: { _all: 5 }, _sum: { finalAmount: 1000 } },
                { paymentMethod: 'SePay', _count: { _all: 2 }, _sum: { finalAmount: null } }
            ]);

            await adminAnalyticsController.getPaymentMethods(req, res);

            expect(res.json).toHaveBeenCalledWith({
                data: [
                    { method: 'COD', count: 5, revenue: 1000 },
                    { method: 'SePay', count: 2, revenue: 0 }
                ]
            });
        });

        it('should return 500 on database error', async () => {
            prisma.order.groupBy.mockRejectedValue(new Error('DB down'));

            await adminAnalyticsController.getPaymentMethods(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('getCategoryRevenue', () => {
        it('should bucket revenue into categories, unmatched items go to Accessories', async () => {
            prisma.orderItem.findMany.mockResolvedValue([
                { name: 'iPhone 15 Pro', qty: 1, price: 100 },
                { name: 'iPad Air M2', qty: 2, price: 50 },
                { name: 'Magic Mouse', qty: 1, price: 30 },
                { name: null, qty: 1, price: 10 }
            ]);

            await adminAnalyticsController.getCategoryRevenue(req, res);

            const { data } = res.json.mock.calls[0][0];
            const byCat = Object.fromEntries(data.map(d => [d.category, d.revenue]));
            expect(byCat['iPhone']).toBe(100);
            expect(byCat['iPad']).toBe(100);
            expect(byCat['Accessories']).toBe(40);
            expect(byCat['Mac']).toBe(0);
        });

        it('should return 500 on database error', async () => {
            prisma.orderItem.findMany.mockRejectedValue(new Error('DB down'));

            await adminAnalyticsController.getCategoryRevenue(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });
});
