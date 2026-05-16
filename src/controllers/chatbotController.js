const jwt = require('jsonwebtoken');
const { getModel } = require('../config/gemini');
const prisma = require('../config/postgres');
const Product = require('../models/Product');

/**
 * Handle chatbot messages (supports both authenticated users and guests)
 */
exports.handleChat = async (req, res) => {
    console.log('=== CHAT REQUEST RECEIVED ===');

    // Optional authentication - support both logged-in users and guests
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
    } else {
        console.log('👤 Guest user - no token provided');
    }

    const userMessage = req.body.message;
    console.log('Message:', userMessage);

    // Validate input
    if (!userMessage || typeof userMessage !== 'string' || userMessage.trim() === '') {
        console.log('❌ Empty or invalid message');
        return res.status(400).json({ reply: "⚠️ Please enter a message." });
    }

    // Check model initialization
    const model = getModel();
    console.log('Model status:', model ? 'INITIALIZED' : 'NOT INITIALIZED');
    if (!model) {
        console.error('❌ Gemini model not initialized');
        return res.status(503).json({ reply: "AI system is under maintenance." });
    }

    try {
        let contextData = { customer: "Khách vãng lai", recent_orders: [], available_products: [] };

        // Load user data if authenticated
        if (userId) {
            try {
                console.log('📊 Fetching user data...');
                const user = await prisma.user.findUnique({ where: { id: userId } });
                if (user) {
                    contextData.customer = {
                        name: user.email.split('@')[0],
                        rank: user.rank,
                        points: user.points
                    };
                    console.log('✅ User data loaded');
                }

                console.log('📊 Fetching orders...');
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
                console.log('✅ Orders loaded:', orders.length);
            } catch (dbError) {
                console.error("❌ DB Error:", dbError.message);
            }
        }

        // Load available products
        console.log('📊 Fetching products...');
        const products = await Product.find({ stock: { $gt: 0 } }).select('name price category').limit(50);
        contextData.available_products = products.map(p => ({
            name: p.name,
            price: p.price.toLocaleString('vi-VN') + 'đ',
            category: p.category
        }));
        console.log('✅ Products loaded:', products.length);

        // Fast regex-based intent detection
        const userMessageLower = userMessage.toLowerCase();
        const priceKeywords = ['giá', 'bao nhiêu', 'tiền', 'price', 'cost', 'giá cả', 'giá tiền', 'mức giá', 'mua', 'đặt', 'order', 'buy', 'cần'];
        const productKeywords = ['iphone', 'ip', 'macbook', 'mac', 'ipad', 'watch', 'airpods', 'airpod'];

        const hasPriceIntent = priceKeywords.some(kw => userMessageLower.includes(kw));
        const hasProductMention = productKeywords.some(kw => userMessageLower.includes(kw));

        console.log('🔍 Quick intent check:', { hasPriceIntent, hasProductMention });

        // Handle price queries without AI
        if (hasPriceIntent && hasProductMention) {
            console.log('💰 Price query detected - using regex extraction');

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
                if (match) {
                    productName = match[0];
                    break;
                }
            }

            if (!productName) {
                const found = productKeywords.find(kw => userMessageLower.includes(kw));
                if (found) productName = found;
            }

            if (productName) {
                console.log('📦 Extracted product:', productName);

                const searchRegex = new RegExp(productName, 'i');
                let products = await Product.find({
                    name: searchRegex,
                    stock: { $gt: 0 }
                }).limit(5);

                if (products.length > 0) {
                    console.log(`✅ Found ${products.length} matching products`);

                    const formattedProducts = products.map(p => ({
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
                        message: products.length === 1
                            ? `Here is information about ${products[0].name}:`
                            : `I found ${products.length} matching products:`
                    });
                } else {
                    return res.json({
                        type: 'text',
                        reply: `❓ Sorry, I couldn't find any product matching "${productName}" in our stock. You can:\n• Try other keywords (e.g., "iPhone 16", "MacBook Pro")\n• View all products at /store.html\n• Contact us: 0962923329`
                    });
                }
            }
        }

        // Handle general queries with AI
        console.log('💬 General query - calling Gemini AI');

        const systemPrompt = `
        YOU ARE: AI assistant for Apple Store.
        DATA:
        - Customer: ${JSON.stringify(contextData.customer)}
        - Recent orders: ${JSON.stringify(contextData.recent_orders)}
        - Products: ${JSON.stringify(contextData.available_products)}
        TASK: Answer concisely and accurately about orders, promotions, and consultations.
        User asks: "${userMessage}"
        `;

        console.log('🤖 Calling Gemini API...');
        console.log('Prompt length:', systemPrompt.length);

        let result, response, replyText;

        try {
            result = await model.generateContent(systemPrompt);
            console.log('✅ Gemini API call successful');
        } catch (apiError) {
            console.error('❌ Gemini API call failed:', apiError.message);
            throw new Error('GEMINI_API_ERROR: ' + apiError.message);
        }

        try {
            response = await result.response;
            replyText = response.text();
            console.log('✅ Reply extracted, length:', replyText?.length || 0);
        } catch (parseError) {
            console.error('❌ Failed to parse Gemini response:', parseError.message);
            throw new Error('GEMINI_PARSE_ERROR: ' + parseError.message);
        }

        if (!replyText || replyText.trim() === '') {
            console.warn('⚠️ Gemini returned empty response');
            return res.json({
                reply: "Sorry, I couldn't generate a response at this time. Please try again or ask a different question."
            });
        }

        res.json({ type: 'text', reply: replyText });

    } catch (error) {
        console.error('❌ CHAT ERROR - FULL DETAILS:');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);

        let fallbackReply = "Sorry, I'm experiencing technical issues. Please try again later.";
        const errorMsg = error.message?.toLowerCase() || '';

        if (errorMsg.includes('quota') || errorMsg.includes('rate limit') || errorMsg.includes('resource_exhausted')) {
            fallbackReply = "⚠️ I am currently overloaded. Please contact hotline: 0962923329 for immediate support.";
        } else if (errorMsg.includes('network') || errorMsg.includes('timeout') || errorMsg.includes('econnrefused')) {
            fallbackReply = "🔌 AI connection interrupted. Please try again in a few seconds.";
        } else if (errorMsg.includes('invalid') || errorMsg.includes('api key')) {
            fallbackReply = "⚙️ AI configuration issue. Please contact support.";
        }

        res.status(500).json({ reply: fallbackReply });
    }
};
