const prisma = require('../config/postgres');

function formatDateKey(date, groupBy) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    if (groupBy === 'month') return `${year}-${month}`;
    if (groupBy === 'week') {
        const dayOfWeek = d.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const monday = new Date(d);
        monday.setDate(d.getDate() - daysToMonday);
        monday.setHours(0, 0, 0, 0);
        return monday.toISOString().split('T')[0];
    }
    return `${year}-${month}-${day}`;
}

function generateDateKeys(from, to, groupBy) {
    const keys = [];
    const seen = new Set();
    const current = new Date(from);
    current.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);

    while (current <= end) {
        const key = formatDateKey(current, groupBy);
        if (!seen.has(key)) {
            keys.push(key);
            seen.add(key);
        }
        if (groupBy === 'month') current.setMonth(current.getMonth() + 1);
        else if (groupBy === 'week') current.setDate(current.getDate() + 7);
        else current.setDate(current.getDate() + 1);
    }
    return keys;
}

// GET /api/admin/analytics/revenue?from=YYYY-MM-DD&to=YYYY-MM-DD&groupBy=day|week|month
exports.getRevenue = async (req, res) => {
    try {
        const { from, to, groupBy = 'day' } = req.query;
        const fromDate = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const toDate = to ? new Date(to) : new Date();
        toDate.setHours(23, 59, 59, 999);

        const orders = await prisma.order.findMany({
            where: {
                status: { in: ['Confirmed', 'Completed'] },
                createdAt: { gte: fromDate, lte: toDate }
            },
            select: { createdAt: true, finalAmount: true }
        });

        const grouped = new Map();
        for (const order of orders) {
            const key = formatDateKey(order.createdAt, groupBy);
            grouped.set(key, (grouped.get(key) || 0) + order.finalAmount);
        }

        const allKeys = generateDateKeys(fromDate, toDate, groupBy);
        const data = allKeys.map(key => ({ date: key, revenue: grouped.get(key) || 0 }));

        res.json({ data });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET /api/admin/analytics/top-products?limit=10
exports.getTopProducts = async (req, res) => {
    try {
        const limit = Math.min(20, parseInt(req.query.limit) || 10);

        const items = await prisma.orderItem.findMany({
            where: { order: { status: { in: ['Confirmed', 'Completed'] } } },
            select: { name: true, qty: true, price: true, image: true }
        });

        const productMap = {};
        for (const item of items) {
            const key = item.name || 'Unknown';
            if (!productMap[key]) {
                productMap[key] = { name: key, image: item.image, qty: 0, revenue: 0 };
            }
            productMap[key].qty += item.qty;
            productMap[key].revenue += item.qty * item.price;
        }

        const data = Object.values(productMap)
            .sort((a, b) => b.qty - a.qty)
            .slice(0, limit);

        res.json({ data });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET /api/admin/analytics/order-funnel
exports.getOrderFunnel = async (req, res) => {
    try {
        const groups = await prisma.order.groupBy({
            by: ['status'],
            _count: { _all: true }
        });

        const data = groups.map(g => ({ status: g.status, count: g._count._all }));
        res.json({ data });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET /api/admin/analytics/user-segments
exports.getUserSegments = async (req, res) => {
    try {
        const groups = await prisma.user.groupBy({
            by: ['rank'],
            _count: { _all: true }
        });

        const data = groups.map(g => ({ rank: g.rank, count: g._count._all }));
        res.json({ data });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET /api/admin/analytics/payment-methods
exports.getPaymentMethods = async (req, res) => {
    try {
        const groups = await prisma.order.groupBy({
            by: ['paymentMethod'],
            _count: { _all: true },
            _sum: { finalAmount: true },
            where: { status: { in: ['Confirmed', 'Completed'] } }
        });

        const data = groups.map(g => ({
            method: g.paymentMethod,
            count: g._count._all,
            revenue: g._sum.finalAmount || 0
        }));
        res.json({ data });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET /api/admin/analytics/category-revenue
exports.getCategoryRevenue = async (req, res) => {
    try {
        const items = await prisma.orderItem.findMany({
            where: { order: { status: { in: ['Confirmed', 'Completed'] } } },
            select: { name: true, qty: true, price: true }
        });

        const CATEGORIES = ['iPhone', 'iPad', 'Mac', 'Apple Watch', 'AirPods', 'Apple TV', 'Accessories'];
        const categoryMap = {};
        for (const cat of CATEGORIES) categoryMap[cat] = 0;

        for (const item of items) {
            const name = (item.name || '').toLowerCase();
            let matched = false;
            for (const cat of CATEGORIES) {
                if (name.includes(cat.toLowerCase())) {
                    categoryMap[cat] += item.qty * item.price;
                    matched = true;
                    break;
                }
            }
            if (!matched) categoryMap['Accessories'] += item.qty * item.price;
        }

        const data = CATEGORIES.map(cat => ({ category: cat, revenue: categoryMap[cat] }));
        res.json({ data });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
