const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getGenAI } = require('../config/gemini');
const prisma = require('../config/postgres');
const Product = require('../models/Product');

// ── Session store (in-memory, 30-minute TTL) ─────────────────────────────────
const sessions = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_HISTORY_TURNS = 20; // 20 pairs = 40 messages

setInterval(() => {
    const now = Date.now();
    for (const [id, s] of sessions) {
        if (now - s.lastActive > SESSION_TTL_MS) sessions.delete(id);
    }
}, 10 * 60 * 1000);

// ── FAQ rule-based matcher (zero quota cost) ─────────────────────────────────
function matchFAQ(msg) {
    if (/(bảo hành|bao hanh|warranty)/.test(msg))
        return '🛡️ **Bảo hành:** 12 tháng chính hãng Apple. Đổi máy mới trong 30 ngày nếu lỗi nhà sản xuất.';
    if (/(đổi trả|doi tra|hoàn trả|hoan tra|return|refund)/.test(msg))
        return '🔄 **Đổi trả:** 7 ngày nếu sản phẩm lỗi, còn nguyên hộp và phụ kiện đầy đủ.';
    if (/(vận chuyển|van chuyen|giao hàng|giao hang|ship|delivery)/.test(msg))
        return '🚚 **Vận chuyển:** Miễn phí toàn quốc đơn từ 500.000₫. Thời gian giao: 2–3 ngày làm việc.';
    if (/(thanh toán|thanh toan|payment|cod|vnpay|sepay|qr)/.test(msg))
        return '💳 **Thanh toán:** COD (tiền mặt khi nhận), VNPay (thẻ/ví điện tử), SePay (QR chuyển khoản).';
    if (/(trả góp|tra gop|installment|góp|gop|fe credit|hd saison)/.test(msg))
        return '💰 **Trả góp 0%:** Đơn từ 3 triệu. Hợp tác FE Credit và HD Saison.';
    if (/(tích điểm|tich diem|điểm thưởng|diem thuong|loyalty|voucher)/.test(msg))
        return '⭐ **Tích điểm:** 1 điểm / 100.000₫. Đổi điểm lấy voucher giảm giá.';
    if (/(hotline|liên hệ|lien he|số điện thoại|so dien thoai|contact|\bphone\b|hỗ trợ|ho tro)/.test(msg))
        return '📞 **Hotline:** 0962 923 329 (8h–22h hàng ngày). Hoặc chat trực tiếp tại đây!';
    if (/(giờ làm việc|gio lam viec|mở cửa|mo cua|giờ mở|working hours|open)/.test(msg))
        return '🕗 **Giờ hoạt động:** 8h–22h mỗi ngày (kể cả thứ 7, CN và ngày lễ).';
    if (/(xin chào|chào|hello|hi\b|hey)/.test(msg))
        return '👋 Xin chào! Tôi là trợ lý AI của Apple Store Việt Nam. Tôi có thể giúp bạn tìm sản phẩm, tra cứu đơn hàng, hoặc giải đáp chính sách cửa hàng.';
    return null;
}

// ── Main handler ─────────────────────────────────────────────────────────────
exports.handleChat = async (req, res) => {
    console.log('=== CHAT REQUEST RECEIVED ===');

    const authHeader = req.headers.authorization || req.headers.token;
    let userId = null;

    if (authHeader) {
        try {
            const token = authHeader.split(" ")[1];
            const userPayload = jwt.verify(token, process.env.JWT_SECRET);
            userId = userPayload.id;
            console.log('✅ Authenticated user:', userId);
        } catch (err) {
            console.warn('⚠️ Invalid token, treating as guest');
        }
    }

    const userMessage = req.body.message;
    const clientSessionId = req.body.sessionId || null;
    console.log('Message:', userMessage);

    if (!userMessage || typeof userMessage !== 'string' || userMessage.trim() === '') {
        return res.status(400).json({ reply: "⚠️ Please enter a message." });
    }

    const genAI = getGenAI();
    if (!genAI) {
        return res.status(503).json({ reply: "AI system is under maintenance." });
    }

    try {
        let contextData = { customer: "Khách vãng lai", recent_orders: [], available_products: [] };

        if (userId) {
            try {
                const user = await prisma.user.findUnique({ where: { id: userId } });
                if (user) {
                    contextData.customer = {
                        name: user.email.split('@')[0],
                        rank: user.rank,
                        points: user.points
                    };
                }
                const orders = await prisma.order.findMany({
                    where: { userId },
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                    include: { items: true }
                });
                contextData.recent_orders = orders.map(o => ({
                    id: o.id.slice(-6).toUpperCase(),
                    status: o.status,
                    total: (o.finalAmount || 0).toLocaleString('vi-VN') + 'đ',
                    items: o.items.map(i => i.name).join(", "),
                    date: o.createdAt.toISOString().split('T')[0]
                }));
            } catch (dbError) {
                console.error("❌ DB Error:", dbError.message);
            }
        }

        const products = await Product.find({ stock: { $gt: 0 } }).select('name price category').limit(50);
        contextData.available_products = products.map(p => ({
            name: p.name,
            price: p.price.toLocaleString('vi-VN') + 'đ',
            category: p.category
        }));

        // ── Fast-path: FAQ rule-based (no Gemini quota used) ────────────────
        const userMessageLower = userMessage.toLowerCase();
        const faqMatch = matchFAQ(userMessageLower);
        if (faqMatch) return res.json({ type: 'text', reply: faqMatch });

        // ── Fast-path: product card ──────────────────────────────────────────
        const priceKeywords = ['giá', 'bao nhiêu', 'tiền', 'price', 'cost', 'giá cả', 'giá tiền', 'mức giá', 'mua', 'đặt', 'order', 'buy', 'cần'];
        const productKeywords = ['iphone', 'ip', 'macbook', 'mac', 'ipad', 'watch', 'airpods', 'airpod'];

        const hasPriceIntent = priceKeywords.some(kw => userMessageLower.includes(kw));
        const hasProductMention = productKeywords.some(kw => userMessageLower.includes(kw));

        if (hasPriceIntent && hasProductMention) {
            let productName = null;
            const patterns = [
                /(?:iphone|ip)\s*(\d+)\s*(pro|max|plus|pro max)?/i,
                /macbook\s*(air|pro)?/i,
                /ipad\s*(pro|air|mini)?/i,
                /apple\s*watch\s*(series\s*\d+|ultra|se)?/i,
                /airpods?\s*(max|pro)?/i
            ];
            for (const pattern of patterns) {
                const match = userMessage.match(pattern);
                if (match) { productName = match[0]; break; }
            }
            if (!productName) {
                const found = productKeywords.find(kw => userMessageLower.includes(kw));
                if (found) productName = found;
            }
            if (productName) {
                const searchRegex = new RegExp(productName, 'i');
                let matched = await Product.find({ name: searchRegex, stock: { $gt: 0 } }).limit(5);
                if (matched.length > 0) {
                    const formattedProducts = matched.map(p => ({
                        id: p._id.toString(),
                        name: p.name,
                        price: p.price,
                        priceFormatted: p.price.toLocaleString('vi-VN') + '₫',
                        image: p.image_url,
                        category: p.category,
                        stock: p.stock
                    }));
                    return res.json({
                        type: 'product_card',
                        products: formattedProducts,
                        message: matched.length === 1
                            ? `Here is information about ${matched[0].name}:`
                            : `I found ${matched.length} matching products:`
                    });
                } else {
                    return res.json({
                        type: 'text',
                        reply: `❓ Sorry, I couldn't find any product matching "${productName}". Try: "iPhone 16", "MacBook Pro", or visit /store.html`
                    });
                }
            }
        }

        // ── Lookup specific order if user mentions an order ID ───────────────
        const orderIdMatch = userMessage.match(/\b([A-Z0-9]{6})\b/);
        if (orderIdMatch && userId) {
            try {
                const specificOrder = await prisma.order.findFirst({
                    where: { userId, id: { endsWith: orderIdMatch[1].toLowerCase() } },
                    include: { items: true }
                });
                if (specificOrder && !contextData.recent_orders.find(o => o.id === orderIdMatch[1])) {
                    contextData.recent_orders.unshift({
                        id: specificOrder.id.slice(-6).toUpperCase(),
                        status: specificOrder.status,
                        paymentStatus: specificOrder.paymentStatus,
                        total: (specificOrder.finalAmount || 0).toLocaleString('vi-VN') + 'đ',
                        items: specificOrder.items.map(i => i.name).join(", "),
                        date: specificOrder.createdAt.toISOString().split('T')[0],
                        address: specificOrder.recipientAddress
                    });
                }
            } catch (_) {}
        }

        // ── General query: streaming with conversation memory ────────────────
        const activeSessionId = clientSessionId && sessions.has(clientSessionId)
            ? clientSessionId
            : crypto.randomUUID();
        const session = sessions.get(activeSessionId) || { history: [], lastActive: Date.now() };

        const STORE_POLICIES = `CHÍNH SÁCH CỬA HÀNG:
- Bảo hành: 12 tháng chính hãng Apple, đổi máy mới trong 30 ngày nếu lỗi nhà sản xuất
- Đổi trả: 7 ngày nếu sản phẩm lỗi, còn nguyên hộp và phụ kiện
- Vận chuyển: miễn phí toàn quốc đơn từ 500.000đ, giao 2-3 ngày
- Thanh toán: COD, VNPay (thẻ/ví điện tử), SePay (QR chuyển khoản)
- Hotline: 0962923329 (8h-22h hàng ngày)
- Trả góp 0%: đơn từ 3 triệu, hợp tác FE Credit và HD Saison
- Tích điểm: 1 điểm/100.000đ, đổi voucher giảm giá`;

        // Inject context into the message itself — reliable across all Gemini SDK versions.
        // History stores the plain user message; context is freshly prepended each turn.
        const contextPrefix = `Bạn là trợ lý AI của Apple Store Việt Nam. Trả lời ngắn gọn bằng tiếng Việt, dựa trên dữ liệu sau:
Khách hàng: ${JSON.stringify(contextData.customer)}
Đơn hàng gần đây: ${JSON.stringify(contextData.recent_orders)}
Sản phẩm có sẵn: ${JSON.stringify(contextData.available_products)}
${STORE_POLICIES}

Câu hỏi của khách: `;

        const messageToGemini = contextPrefix + userMessage;

        // Try primary model, fall back to gemini-1.5-flash on quota error.
        // SSE headers are written only AFTER we have a live stream — so quota errors
        // can still return a clean JSON response instead of a broken SSE stream.
        const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];
        let streamResult = null;
        let lastError = null;
        for (const modelName of FALLBACK_MODELS) {
            try {
                const chatModel = genAI.getGenerativeModel({ model: modelName });
                const chat = chatModel.startChat({ history: session.history });
                streamResult = await chat.sendMessageStream(messageToGemini);
                break;
            } catch (err) {
                const msg = err.message?.toLowerCase() || '';
                if (msg.includes('429') || msg.includes('quota') || msg.includes('resource_exhausted') || msg.includes('404')) {
                    lastError = err;
                    continue;
                }
                throw err;
            }
        }
        if (!streamResult) {
            return res.status(503).json({
                type: 'text',
                reply: '⚠️ AI đang quá tải (cả hai model đều hết quota). Vui lòng thử lại sau hoặc gọi hotline: 0962 923 329.'
            });
        }

        // Set SSE headers — only after stream is confirmed alive
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        // Send sessionId as first event so client can persist it
        res.write(`data: ${JSON.stringify({ sessionId: activeSessionId })}\n\n`);

        const result = streamResult;
        let fullResponse = '';

        for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
                fullResponse += text;
                res.write(`data: ${JSON.stringify({ text })}\n\n`);
            }
        }

        res.write('data: [DONE]\n\n');
        res.end();

        // Save plain userMessage to history (not the context-wrapped version)
        session.history.push(
            { role: 'user', parts: [{ text: userMessage }] },
            { role: 'model', parts: [{ text: fullResponse }] }
        );
        if (session.history.length > MAX_HISTORY_TURNS * 2) {
            session.history = session.history.slice(-MAX_HISTORY_TURNS * 2);
        }
        session.lastActive = Date.now();
        sessions.set(activeSessionId, session);

    } catch (error) {
        console.error('❌ CHAT ERROR:', error.message);

        // If SSE headers not yet sent, send JSON error (same {type,reply} format as FAQ)
        if (!res.headersSent) {
            const errorMsg = error.message?.toLowerCase() || '';
            const isQuota = errorMsg.includes('quota') || errorMsg.includes('429') || errorMsg.includes('resource_exhausted');
            const reply = isQuota
                ? '⚠️ AI đang quá tải. Vui lòng thử lại sau hoặc gọi hotline: 0962 923 329.'
                : '🔌 Hệ thống gặp sự cố. Vui lòng thử lại.';
            return res.status(503).json({ type: 'text', reply });
        }

        // SSE already started — send descriptive error then close
        try {
            const errMsg = error.message?.toLowerCase() || '';
            const sseError = (errMsg.includes('quota') || errMsg.includes('429') || errMsg.includes('resource_exhausted'))
                ? '⚠️ AI đang quá tải. Vui lòng thử lại sau ít phút hoặc gọi hotline: 0962 923 329.'
                : '🔌 Kết nối bị gián đoạn. Vui lòng thử lại.';
            res.write(`data: ${JSON.stringify({ text: sseError })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
        } catch (_) {}
    }
};
