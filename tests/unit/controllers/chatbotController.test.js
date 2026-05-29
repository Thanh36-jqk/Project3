const jwt = require('jsonwebtoken');
const { handleChat } = require('../../../src/controllers/chatbotController');
const { getModel } = require('../../../src/config/gemini');
const prisma = require('../../../src/config/postgres');
const Product = require('../../../src/models/Product');

jest.mock('jsonwebtoken');
jest.mock('../../../src/config/gemini', () => ({ getModel: jest.fn() }));
jest.mock('../../../src/config/postgres', () => ({
    user: { findUnique: jest.fn() },
    order: { findMany: jest.fn() },
}));
jest.mock('../../../src/models/Product');

// Helper: mock Product.find for both call patterns in the controller:
//   call 1 — context load: .select('...').limit(50)
//   call 2 — price search:  .limit(5)
function mockProductFind(contextProducts = [], searchProducts = []) {
    Product.find
        .mockReturnValueOnce({
            select: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue(contextProducts) }),
            limit: jest.fn().mockResolvedValue(contextProducts),
        })
        .mockReturnValueOnce({
            select: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue(searchProducts) }),
            limit: jest.fn().mockResolvedValue(searchProducts),
        });
}

const SAMPLE_PRODUCT = {
    _id: { toString: () => 'prod001' },
    name: 'iPhone 15',
    price: 22000000,
    image_url: 'images/iphone15.webp',
    category: 'Phone',
    stock: 50,
};

describe('Chatbot Controller — handleChat', () => {
    let req, res, mockModel;

    beforeEach(() => {
        jest.clearAllMocks();

        req = { headers: {}, body: { message: 'xin chào' } };
        res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        mockModel = {
            generateContent: jest.fn().mockResolvedValue({
                response: { text: jest.fn().mockReturnValue('AI reply text') },
            }),
        };
        getModel.mockReturnValue(mockModel);

        // Default: single Product.find returning empty (non-price-intent path uses 1 call)
        Product.find.mockReturnValue({
            select: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([]) }),
            limit: jest.fn().mockResolvedValue([]),
        });

        prisma.user.findUnique.mockResolvedValue(null);
        prisma.order.findMany.mockResolvedValue([]);
    });

    // ─── 1. Input Validation ──────────────────────────────────────────────────

    describe('Input Validation', () => {
        it('returns 400 when message is empty string', async () => {
            req.body.message = '';
            await handleChat(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ reply: expect.stringContaining('Please enter') });
        });

        it('returns 400 when message is whitespace only', async () => {
            req.body.message = '   ';
            await handleChat(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('returns 400 when message field is missing from body', async () => {
            req.body = {};
            await handleChat(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    // ─── 2. Gemini Model Unavailable ─────────────────────────────────────────

    describe('Gemini Model Unavailable', () => {
        it('returns 503 when Gemini model is not initialised', async () => {
            getModel.mockReturnValue(null);
            await handleChat(req, res);
            expect(res.status).toHaveBeenCalledWith(503);
            expect(res.json).toHaveBeenCalledWith({ reply: expect.stringContaining('maintenance') });
        });
    });

    // ─── 3. Authentication ────────────────────────────────────────────────────

    describe('Authentication', () => {
        it('treats request as guest when no Authorization header is provided', async () => {
            req.headers = {};
            await handleChat(req, res);
            expect(jwt.verify).not.toHaveBeenCalled();
            expect(prisma.user.findUnique).not.toHaveBeenCalled();
            expect(res.json).toHaveBeenCalled();
        });

        it('loads user data and orders when a valid Bearer token is provided', async () => {
            jwt.verify.mockReturnValue({ id: 'user-abc' });
            req.headers.authorization = 'Bearer valid.jwt.token';
            prisma.user.findUnique.mockResolvedValue({
                id: 'user-abc', email: 'buyer@example.com', rank: 'Gold', points: 800,
            });
            prisma.order.findMany.mockResolvedValue([]);
            await handleChat(req, res);
            expect(jwt.verify).toHaveBeenCalledWith('valid.jwt.token', process.env.JWT_SECRET);
            expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-abc' } });
            expect(prisma.order.findMany).toHaveBeenCalled();
        });

        it('falls back to guest when JWT verification throws', async () => {
            jwt.verify.mockImplementation(() => { throw new Error('jwt malformed'); });
            req.headers.authorization = 'Bearer bad-token';
            await handleChat(req, res);
            expect(prisma.user.findUnique).not.toHaveBeenCalled();
            expect(res.json).toHaveBeenCalled();
        });

        it('reads token from the token header as well as Authorization', async () => {
            jwt.verify.mockReturnValue({ id: 'user-xyz' });
            req.headers.token = 'Bearer another.valid.token';
            prisma.user.findUnique.mockResolvedValue({
                id: 'user-xyz', email: 'alt@example.com', rank: 'Silver', points: 0,
            });
            prisma.order.findMany.mockResolvedValue([]);
            await handleChat(req, res);
            expect(jwt.verify).toHaveBeenCalled();
            expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-xyz' } });
        });
    });

    // ─── 4. Product Price Intent (Regex Path) ─────────────────────────────────

    describe('Product Price Intent — Regex Path', () => {
        it('returns product_card with formatted data when iPhone is found in DB', async () => {
            req.body.message = 'tôi muốn mua iPhone 15';
            mockProductFind([], [SAMPLE_PRODUCT]);
            await handleChat(req, res);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'product_card',
                    products: expect.arrayContaining([
                        expect.objectContaining({ name: 'iPhone 15', price: 22000000 }),
                    ]),
                })
            );
            expect(mockModel.generateContent).not.toHaveBeenCalled();
        });

        it('returns not-found text reply when no matching product is in stock', async () => {
            req.body.message = 'giá iPhone 99 Pro bao nhiêu?';
            mockProductFind([], []);
            await handleChat(req, res);
            const payload = res.json.mock.calls[0][0];
            expect(payload.type).toBe('text');
            expect(payload.reply).toMatch(/couldn't find/i);
        });

        it('returns product_card for AirPods query', async () => {
            const airpods = { ...SAMPLE_PRODUCT, name: 'AirPods Pro 2', category: 'HeadPhone' };
            req.body.message = 'cần mua airpods pro';
            mockProductFind([], [airpods]);
            await handleChat(req, res);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ type: 'product_card' }));
        });

        it('returns product_card for MacBook query', async () => {
            const macbook = { ...SAMPLE_PRODUCT, name: 'MacBook Pro M3', price: 35000000, category: 'Laptop' };
            req.body.message = 'mua MacBook Pro';
            mockProductFind([], [macbook]);
            await handleChat(req, res);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ type: 'product_card' }));
        });

        it('includes singular message text when exactly one product matches', async () => {
            req.body.message = 'cần mua iphone 16';
            mockProductFind([], [SAMPLE_PRODUCT]);
            await handleChat(req, res);
            const payload = res.json.mock.calls[0][0];
            expect(payload.message).toMatch(/here is information/i);
        });

        it('includes plural message text when multiple products match', async () => {
            const second = { ...SAMPLE_PRODUCT, _id: { toString: () => 'prod002' }, name: 'iPhone 15 Plus' };
            req.body.message = 'mua iPhone 15';
            mockProductFind([], [SAMPLE_PRODUCT, second]);
            await handleChat(req, res);
            const payload = res.json.mock.calls[0][0];
            expect(payload.message).toMatch(/I found 2/i);
        });
    });

    // ─── 5. Gemini AI Path ────────────────────────────────────────────────────

    describe('Gemini AI Path', () => {
        it('returns type:text reply for a general question', async () => {
            req.body.message = 'chính sách bảo hành như thế nào?';
            mockModel.generateContent.mockResolvedValue({
                response: { text: jest.fn().mockReturnValue('Bảo hành 12 tháng.') },
            });
            await handleChat(req, res);
            expect(res.json).toHaveBeenCalledWith({ type: 'text', reply: 'Bảo hành 12 tháng.' });
        });

        it('returns fallback message when Gemini responds with empty text', async () => {
            req.body.message = 'hỏi bất kỳ';
            mockModel.generateContent.mockResolvedValue({
                response: { text: jest.fn().mockReturnValue('') },
            });
            await handleChat(req, res);
            expect(res.json).toHaveBeenCalledWith({
                reply: expect.stringContaining("couldn't generate"),
            });
        });

        it('returns "overloaded" message when Gemini hits quota limit', async () => {
            req.body.message = 'xin chào';
            mockModel.generateContent.mockRejectedValue(new Error('quota exceeded resource_exhausted'));
            await handleChat(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ reply: expect.stringContaining('overloaded') });
        });

        it('returns "connection interrupted" message on network / timeout error', async () => {
            req.body.message = 'xin chào';
            mockModel.generateContent.mockRejectedValue(new Error('network timeout ECONNREFUSED'));
            await handleChat(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ reply: expect.stringContaining('connection') });
        });

        it('returns "configuration issue" message on invalid API key error', async () => {
            req.body.message = 'xin chào';
            mockModel.generateContent.mockRejectedValue(new Error('invalid api key'));
            await handleChat(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ reply: expect.stringContaining('configuration') });
        });

        it('returns generic "technical issues" fallback for unknown errors', async () => {
            req.body.message = 'xin chào';
            mockModel.generateContent.mockRejectedValue(new Error('some unexpected failure'));
            await handleChat(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ reply: expect.stringContaining('technical issues') });
        });
    });

    // ─── 6. Database Errors ───────────────────────────────────────────────────

    describe('Database Errors', () => {
        it('continues as guest (does not return 500) when user DB lookup throws', async () => {
            jwt.verify.mockReturnValue({ id: 'user-db-fail' });
            req.headers.authorization = 'Bearer some.token';
            prisma.user.findUnique.mockRejectedValue(new Error('DB connection lost'));
            await handleChat(req, res);
            expect(res.status).not.toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalled();
        });

        it('returns 500 when Product.find throws', async () => {
            Product.find.mockImplementation(() => { throw new Error('MongoDB connection error'); });
            await handleChat(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });
});
