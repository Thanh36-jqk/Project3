const jwt = require('jsonwebtoken');
const { handleChat } = require('../../../src/controllers/chatbotController');
const { getGenAI } = require('../../../src/config/gemini');
const prisma = require('../../../src/config/postgres');
const Product = require('../../../src/models/Product');

jest.mock('jsonwebtoken');
jest.mock('../../../src/config/gemini', () => ({ getModel: jest.fn(), getGenAI: jest.fn() }));
jest.mock('../../../src/config/postgres', () => ({
    user: { findUnique: jest.fn() },
    order: { findMany: jest.fn(), findFirst: jest.fn() },
    chatMessage: { create: jest.fn(), findMany: jest.fn() },
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

// Build a mock genAI that streams a single text chunk
function makeMockGenAI(streamText = 'AI reply text', rejectWith = null) {
    const streamChunks = rejectWith
        ? null
        : (async function* () { yield { text: () => streamText }; })();

    const mockSendMessageStream = rejectWith
        ? jest.fn().mockRejectedValue(rejectWith)
        : jest.fn().mockResolvedValue({ stream: streamChunks });

    const mockChat = { sendMessageStream: mockSendMessageStream };
    const mockChatModel = { startChat: jest.fn().mockReturnValue(mockChat) };
    return {
        genAI: { getGenerativeModel: jest.fn().mockReturnValue(mockChatModel) },
        mockSendMessageStream,
        mockChat,
    };
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
    let req, res;

    beforeEach(() => {
        jest.resetAllMocks();

        req = { headers: {}, body: { message: 'xin chào' } };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            setHeader: jest.fn(),
            flushHeaders: jest.fn(),
            write: jest.fn(),
            end: jest.fn(),
            headersSent: false,
        };

        // Default genAI mock — streaming "AI reply text"
        const { genAI } = makeMockGenAI('AI reply text');
        getGenAI.mockReturnValue(genAI);

        prisma.user.findUnique.mockResolvedValue(null);
        prisma.order.findMany.mockResolvedValue([]);
        prisma.order.findFirst.mockResolvedValue(null);
        prisma.chatMessage.create.mockResolvedValue({});
        prisma.chatMessage.findMany.mockResolvedValue([]);

        // Default: single Product.find returning empty (non-price-intent path uses 1 call)
        Product.find.mockReturnValue({
            select: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([]) }),
            limit: jest.fn().mockResolvedValue([]),
        });
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

    // ─── 2. FAQ Shortcuts (rule-based, no Gemini) ─────────────────────────────

    describe('FAQ Shortcuts', () => {
        it('returns warranty info without calling Gemini', async () => {
            req.body.message = 'chính sách bảo hành như thế nào?';
            await handleChat(req, res);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'text', reply: expect.stringContaining('Bảo hành') })
            );
            expect(getGenAI).not.toHaveBeenCalled();
        });

        it('returns return-policy info without calling Gemini', async () => {
            req.body.message = 'doi tra nhu the nao';
            await handleChat(req, res);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'text', reply: expect.stringContaining('Đổi trả') })
            );
            expect(getGenAI).not.toHaveBeenCalled();
        });

        it('returns hotline info without calling Gemini', async () => {
            req.body.message = 'hotline la bao nhieu';
            await handleChat(req, res);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'text', reply: expect.stringContaining('0962') })
            );
            expect(getGenAI).not.toHaveBeenCalled();
        });

        it('returns FAQ even when Gemini is unavailable', async () => {
            getGenAI.mockReturnValue(null);
            req.body.message = 'bao hanh may nhieu nam';
            await handleChat(req, res);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'text', reply: expect.stringContaining('Bảo hành') })
            );
            expect(res.status).not.toHaveBeenCalledWith(503);
        });

        it('persists the user question and the FAQ reply, and returns a sessionId', async () => {
            req.body.message = 'chính sách bảo hành như thế nào?';
            await handleChat(req, res);

            expect(prisma.chatMessage.create).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ role: 'user', content: req.body.message, intent: 'bao_hanh' }) })
            );
            expect(prisma.chatMessage.create).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ role: 'model' }) })
            );
            const payload = res.json.mock.calls[0][0];
            expect(payload.sessionId).toEqual(expect.any(String));
        });
    });

    // ─── 3. Gemini Model Unavailable ─────────────────────────────────────────

    describe('Gemini Model Unavailable', () => {
        it('returns 503 when Gemini is not initialised', async () => {
            getGenAI.mockReturnValue(null);
            req.body.message = 'tai sao iphone dat'; // not an FAQ
            await handleChat(req, res);
            expect(res.status).toHaveBeenCalledWith(503);
            expect(res.json).toHaveBeenCalledWith({ reply: expect.stringContaining('maintenance') });
        });
    });

    // ─── 4. Authentication ────────────────────────────────────────────────────

    describe('Authentication', () => {
        it('treats request as guest when no Authorization header is provided', async () => {
            req.headers = {};
            await handleChat(req, res);
            expect(jwt.verify).not.toHaveBeenCalled();
            expect(prisma.user.findUnique).not.toHaveBeenCalled();
        });

        it('loads user data and orders when a valid Bearer token is provided', async () => {
            jwt.verify.mockReturnValue({ id: 'user-abc' });
            req.headers.authorization = 'Bearer valid.jwt.token';
            req.body.message = 'tai sao iphone dat'; // non-FAQ to reach DB path
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
            req.body.message = 'tai sao iphone dat';
            await handleChat(req, res);
            expect(prisma.user.findUnique).not.toHaveBeenCalled();
        });

        it('reads token from the token header as well as Authorization', async () => {
            jwt.verify.mockReturnValue({ id: 'user-xyz' });
            req.headers.token = 'Bearer another.valid.token';
            req.body.message = 'tai sao iphone dat';
            prisma.user.findUnique.mockResolvedValue({
                id: 'user-xyz', email: 'alt@example.com', rank: 'Silver', points: 0,
            });
            prisma.order.findMany.mockResolvedValue([]);
            await handleChat(req, res);
            expect(jwt.verify).toHaveBeenCalled();
            expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-xyz' } });
        });
    });

    // ─── 5. Product Price Intent (Regex Path) ─────────────────────────────────

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

        it('returns product_card for a non-diacritic price question ("gia iphone 16 bao nhieu")', async () => {
            req.body.message = 'gia iphone 16 bao nhieu';
            mockProductFind([], [SAMPLE_PRODUCT]);
            await handleChat(req, res);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ type: 'product_card' }));
        });

        it('does not misfire on "gia" as a substring of "giao" (shipping question, no price intent)', async () => {
            req.body.message = 'giao iphone toi luc nao';
            mockProductFind([]);
            const { genAI } = makeMockGenAI('Giao hàng trong 2-3 ngày.');
            getGenAI.mockReturnValue(genAI);
            await handleChat(req, res);
            expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
        });
    });

    // ─── 6. Gemini AI Path (SSE streaming) ───────────────────────────────────

    describe('Gemini AI Path', () => {
        it('includes product spec/description in the prompt sent to Gemini for richer consultation', async () => {
            req.body.message = 'tai sao iphone dat the';
            mockProductFind([{
                name: 'iPhone 16 Pro Max', price: 31000000, category: 'Phone',
                spec: 'Chip A18 Pro, camera chính 48MP, RAM 8GB', short_description: 'Flagship camera đỉnh cao',
            }], []);
            const { genAI, mockSendMessageStream } = makeMockGenAI('OK');
            getGenAI.mockReturnValue(genAI);

            await handleChat(req, res);

            expect(mockSendMessageStream).toHaveBeenCalledWith(expect.stringContaining('Chip A18 Pro'));
        });

        it('streams reply via SSE for a general question', async () => {
            req.body.message = 'tai sao iphone dat the';
            const { genAI } = makeMockGenAI('iPhone đắt vì linh kiện cao cấp.');
            getGenAI.mockReturnValue(genAI);
            await handleChat(req, res);
            expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
            expect(res.write).toHaveBeenCalledWith(
                expect.stringContaining('"text":"iPhone đắt vì linh kiện cao cấp."')
            );
            expect(res.write).toHaveBeenCalledWith('data: [DONE]\n\n');
            expect(res.end).toHaveBeenCalled();
        });

        it('sends sessionId as first SSE event', async () => {
            req.body.message = 'tai sao iphone dat the';
            await handleChat(req, res);
            expect(res.write).toHaveBeenCalledWith(expect.stringContaining('"sessionId"'));
        });

        it('returns 503 JSON when all models hit quota limit', async () => {
            req.body.message = 'tai sao iphone dat the';
            const quotaError = new Error('quota exceeded resource_exhausted 429');
            const { genAI } = makeMockGenAI('', quotaError);
            getGenAI.mockReturnValue(genAI);
            await handleChat(req, res);
            expect(res.status).toHaveBeenCalledWith(503);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ reply: expect.stringContaining('quá tải') })
            );
        });

        it('reuses a client-provided sessionId not held in memory, rehydrating history from the DB', async () => {
            req.body.message = 'tai sao iphone dat the';
            req.body.sessionId = 'session-from-earlier-server-instance';
            prisma.chatMessage.findMany.mockResolvedValue([
                { role: 'user', content: 'câu hỏi cũ', createdAt: new Date() },
                { role: 'model', content: 'câu trả lời cũ', createdAt: new Date() },
            ]);
            await handleChat(req, res);

            expect(prisma.chatMessage.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: { sessionId: 'session-from-earlier-server-instance' } })
            );
            expect(res.write).toHaveBeenCalledWith(
                expect.stringContaining('"sessionId":"session-from-earlier-server-instance"')
            );
        });

        it('returns 503 JSON with generic message on non-quota error', async () => {
            req.body.message = 'tai sao iphone dat the';
            const netError = new Error('network timeout ECONNREFUSED');
            const { genAI } = makeMockGenAI('', netError);
            getGenAI.mockReturnValue(genAI);
            await handleChat(req, res);
            expect(res.status).toHaveBeenCalledWith(503);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'text' })
            );
        });
    });

    // ─── 7. Database Errors ───────────────────────────────────────────────────

    describe('Database Errors', () => {
        it('continues as guest (does not return 500) when user DB lookup throws', async () => {
            jwt.verify.mockReturnValue({ id: 'user-db-fail' });
            req.headers.authorization = 'Bearer some.token';
            req.body.message = 'tai sao iphone dat';
            prisma.user.findUnique.mockRejectedValue(new Error('DB connection lost'));
            await handleChat(req, res);
            expect(res.status).not.toHaveBeenCalledWith(500);
        });

        it('returns 503 when Product.find throws', async () => {
            req.body.message = 'tai sao iphone dat';
            Product.find.mockImplementation(() => { throw new Error('MongoDB connection error'); });
            await handleChat(req, res);
            expect(res.status).toHaveBeenCalledWith(503);
        });
    });
});
