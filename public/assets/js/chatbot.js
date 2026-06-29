/**
 * chatbot.js — Shared AI chatbot widget
 * Include this script in any page to get the floating chat bubble.
 * Handles auth automatically (guest mode if not logged in).
 */
(function () {
    'use strict';

    const API = 'https://project3-icy1.onrender.com';

    // ── Helpers ─────────────────────────────────────────────────────────────
    function getToken() { return localStorage.getItem('accessToken'); }

    // ── Product color variants (image paths absolute from root) ──────────────
    const colorVariants = {
        'iPhone 11': [
            { name: 'White',  hex: '#f5f5f7', image: '/assets/images/iphone 11/11 white.png' },
            { name: 'Green',  hex: '#aee1cd', image: '/assets/images/iphone 11/11green.png' },
            { name: 'Yellow', hex: '#ffe681', image: '/assets/images/iphone 11/iphone 11 yellow.png' },
            { name: 'Red',    hex: '#ba0c2f', image: '/assets/images/iphone 11/iphone-11 red.png' },
        ],
        'iPhone 12': [
            { name: 'Black',  hex: '#1d1d1f', image: '/assets/images/iphone 12/iphone 12 black.png' },
            { name: 'Purple', hex: '#b9b5d7', image: '/assets/images/iphone 12/iphone 12 purple.png' },
            { name: 'Red',    hex: '#ba0c2f', image: '/assets/images/iphone 12/iphone 12 red.png' },
        ],
        'iPhone 13': [
            { name: 'Black', hex: '#1d1d1f', image: '/assets/images/iphone 13/iphone 13 black.png' },
            { name: 'Blue',  hex: '#276787', image: '/assets/images/iphone 13/iphone 13 blue.png' },
            { name: 'Gold',  hex: '#fad7bd', image: '/assets/images/iphone 13/iphone 13 gold.png' },
        ],
        'iPhone 14': [
            { name: 'White',  hex: '#f5f5f7', image: '/assets/images/iphone 14/iPhone_14 white.png' },
            { name: 'Red',    hex: '#ba0c2f', image: '/assets/images/iphone 14/iphone 14 red.png' },
            { name: 'Purple', hex: '#e0d1e8', image: '/assets/images/iphone 14/iphone_14_purple.png' },
            { name: 'Yellow', hex: '#f9e179', image: '/assets/images/iphone 14/iphone_14_yellow.png' },
        ],
        'iPhone 14 Pro Max': [
            { name: 'Purple', hex: '#594f63', image: '/assets/images/iphone 14 pro max/14_pro_max_purple-removebg-preview.png' },
            { name: 'Gold',   hex: '#fad7a0', image: '/assets/images/iphone 14 pro max/14_promax_gold-removebg-preview.png' },
            { name: 'Black',  hex: '#1d1d1f', image: '/assets/images/iphone 14 pro max/iphone 14 pro max black.png' },
            { name: 'White',  hex: '#f5f5f7', image: '/assets/images/iphone 14 pro max/iphone 14 pro max white.png' },
        ],
        'iPhone 15 Plus': [
            { name: 'Yellow', hex: '#f9e179', image: '/assets/images/iphone 15 plus/15_plus_yellow-removebg-preview.png' },
            { name: 'Green',  hex: '#d5e8d4', image: '/assets/images/iphone 15 plus/iPhone_15_Plus-removebg-preview.png' },
            { name: 'Black',  hex: '#1d1d1f', image: '/assets/images/iphone 15 plus/iphone_15_plus_black-removebg-preview.png' },
            { name: 'Blue',   hex: '#a8c5dd', image: '/assets/images/iphone 15 plus/iphone_15_plus_blue-removebg-preview.png' },
            { name: 'Rose',   hex: '#f4c2c2', image: '/assets/images/iphone 15 plus/iphone_15_plus_rose-removebg-preview.png' },
        ],
        'iPhone 15 Pro Max': [
            { name: 'Silver', hex: '#e3e4e5', image: '/assets/images/iphone 15 pro max/15_pro_max_silver-removebg-preview.png' },
            { name: 'Blue',   hex: '#2d5f7e', image: '/assets/images/iphone 15 pro max/iphone-15-pro-max-blue-removebg-preview.png' },
            { name: 'White',  hex: '#f5f5f7', image: '/assets/images/iphone 15 pro max/iphone_15_pro_max_white-removebg-preview.png' },
        ],
        'iPhone 16 Pro Max': [
            { name: 'Gold Rose', hex: '#e8c4b8', image: '/assets/images/iphone 16 pro max/iphone 16 promax gold rose rm.png' },
            { name: 'White',     hex: '#f5f5f7', image: '/assets/images/iphone 16 pro max/iphone 16 promax white remove.png' },
            { name: 'Black',     hex: '#1d1d1f', image: '/assets/images/iphone 16 pro max/test1.png' },
        ],
        'iPhone SE (3rd Gen)': [
            { name: 'Black', hex: '#1d1d1f', image: '/assets/images/iPhone SE (3rd Gen)/iphone se 3rd black.png' },
            { name: 'Gold',  hex: '#fad7a0', image: '/assets/images/iPhone SE (3rd Gen)/iphone se 3rd gold.png' },
            { name: 'Red',   hex: '#ba0c2f', image: '/assets/images/iPhone SE (3rd Gen)/iphone se 3rd red.png' },
        ],
        'iPhone 7 Plus': [
            { name: 'Black',  hex: '#1d1d1f', image: '/assets/images/Iphone 7 Plus/Iphone 7 plus black.png' },
            { name: 'Gold',   hex: '#fad7a0', image: '/assets/images/Iphone 7 Plus/Iphone 7 plus gold.png' },
            { name: 'Silver', hex: '#e3e4e5', image: '/assets/images/Iphone 7 Plus/Iphone 7 plus silver.png' },
        ],
        'iPhone 8 Plus': [
            { name: 'Black', hex: '#1d1d1f', image: '/assets/images/Iphone 8 Plus/iphone 8 plus black.png' },
            { name: 'Grey',  hex: '#8e8e93', image: '/assets/images/Iphone 8 Plus/iphone 8 plus grey.png' },
            { name: 'Red',   hex: '#ba0c2f', image: '/assets/images/Iphone 8 Plus/iphone 8 plus red.png' },
        ],
        'iPad (10th Gen)': [
            { name: 'Blue',   hex: '#a8dadc', image: '/assets/images/ipad (10th gen)/ipad gen 10 blue.webp' },
            { name: 'Pink',   hex: '#ffc0cb', image: '/assets/images/ipad (10th gen)/ipad gen 10 pink.png' },
            { name: 'Yellow', hex: '#f9e179', image: '/assets/images/ipad (10th gen)/ipad gen 10 yellow.webp' },
        ],
        'iPad Air M2': [
            { name: 'Black', hex: '#1d1d1f', image: '/assets/images/ipad air m2/ipad air m2 black.png' },
            { name: 'Blue',  hex: '#4a90e2', image: '/assets/images/ipad air m2/ipad air m2 blue.png' },
            { name: 'Gold',  hex: '#fad7a0', image: '/assets/images/ipad air m2/ipad air m2 gold.png' },
        ],
        'iPad mini 6': [
            { name: 'Black',  hex: '#1d1d1f', image: '/assets/images/ipad mini 6/ipad mini 6 black.png' },
            { name: 'Gold',   hex: '#fad7a0', image: '/assets/images/ipad mini 6/ipad mini 6 gold.png' },
            { name: 'Purple', hex: '#b9b5d7', image: '/assets/images/ipad mini 6/ipad mini 6 purple.png' },
        ],
        'iPad Pro': [
            { name: 'Black',  hex: '#1d1d1f', image: '/assets/images/ipad pro/ipad pro black.png' },
            { name: 'Silver', hex: '#e3e4e5', image: '/assets/images/ipad pro/ipad pro silver.png' },
        ],
        'iPad Pro M4': [
            { name: 'Black',  hex: '#1d1d1f', image: '/assets/images/ipad pro m4/ipad pro m4 black.png' },
            { name: 'Silver', hex: '#e3e4e5', image: '/assets/images/ipad pro m4/ipad pro m4 silver.png' },
        ],
        'Apple Watch Series 9': [
            { name: 'Blue',  hex: '#4a90e2', image: '/assets/images/Apple Watch Series 9/watch series 9 blue.png' },
            { name: 'Gold',  hex: '#fad7a0', image: '/assets/images/Apple Watch Series 9/watch series 9 gold.png' },
            { name: 'Rose',  hex: '#f4c2c2', image: '/assets/images/Apple Watch Series 9/watch series 9 rose.png' },
            { name: 'Black', hex: '#1d1d1f', image: '/assets/images/Apple Watch Series 9/watch seris 9 black.png' },
        ],
        'Apple Watch SE': [
            { name: 'Black', hex: '#1d1d1f', image: '/assets/images/Apple Watch SE/se black.png' },
            { name: 'Gold',  hex: '#fad7a0', image: '/assets/images/Apple Watch SE/se gold.png' },
        ],
        'Apple Watch Ultra 2': [
            { name: 'Black',  hex: '#1d1d1f', image: '/assets/images/Apple Watch Ultra 2/Apple Watch Ultra 2 black.webp' },
            { name: 'Blue',   hex: '#4a90e2', image: '/assets/images/Apple Watch Ultra 2/Apple Watch Ultra 2 blue.png' },
            { name: 'Orange', hex: '#ff6b35', image: '/assets/images/Apple Watch Ultra 2/Apple Watch Ultra 2 orange.png' },
        ],
        'AirPods Max': [
            { name: 'Black',  hex: '#1d1d1f', image: '/assets/images/Air pod max/airpod max black.png' },
            { name: 'Orange', hex: '#ff6b35', image: '/assets/images/Air pod max/airpod max orange.webp' },
            { name: 'White',  hex: '#f5f5f7', image: '/assets/images/Air pod max/airpod max white.png' },
        ],
        'MacBook Air 15 M3': [
            { name: 'Gold', hex: '#fad7a0', image: '/assets/images/mac air 15/air 15 gold.png' },
            { name: 'Grey', hex: '#535456', image: '/assets/images/mac air 15/macbook air 15 grey.png' },
        ],
    };

    // ── Session ID (persists across page loads in same tab session) ─────────
    function getSessionId() { return sessionStorage.getItem('chatbot-sid') || null; }
    function saveSessionId(id) { sessionStorage.setItem('chatbot-sid', id); }

    // ── HTML injection ───────────────────────────────────────────────────────
    function inject() {
        if (document.getElementById('chat-bubble')) return; // already present
        // Cursor blink animation for streaming
        const style = document.createElement('style');
        style.textContent = '@keyframes _cb-blink{0%,100%{opacity:1}50%{opacity:0}}._cb-cursor{animation:_cb-blink .6s infinite;display:inline-block;margin-left:1px;line-height:1}';
        document.head.appendChild(style);

        const wrapper = document.createElement('div');
        wrapper.id = 'chatbox-proto-wrapper';
        wrapper.innerHTML = `
<div id="chat-bubble" onclick="window._chatbot.toggle()"
    class="fixed bottom-8 right-8 z-[90] w-14 h-14 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-900/40 cursor-pointer hover:scale-110 transition-transform duration-300 group">
    <i class="fas fa-comment-dots text-white text-xl group-hover:animate-bounce"></i>
    <span class="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-[#000]"></span>
</div>

<div id="chat-window"
    class="fixed bottom-24 right-8 w-[350px] h-[500px] bg-[#1c1c1e] border border-white/10 rounded-2xl shadow-2xl z-[90] flex flex-col hidden opacity-0 transform translate-y-10 transition-all duration-300 origin-bottom-right">
    <div class="p-4 border-b border-white/10 bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-t-2xl flex justify-between items-center backdrop-blur-md">
        <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                <i class="fab fa-google text-lg bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-red-500"></i>
            </div>
            <div>
                <h3 class="font-bold text-white text-sm">Apple Assistant</h3>
                <p class="text-[10px] text-green-400 flex items-center gap-1">
                    <span class="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span> Online
                </p>
            </div>
        </div>
        <button onclick="window._chatbot.toggle()" class="text-gray-400 hover:text-white">
            <i class="fas fa-times"></i>
        </button>
    </div>

    <div id="chat-messages" class="flex-1 overflow-y-auto p-4 space-y-3 bg-black/20" style="scrollbar-width:thin;scrollbar-color:#333 transparent;">
        <div class="flex gap-2 items-end">
            <div class="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                <i class="fas fa-robot text-xs text-white"></i>
            </div>
            <div class="bg-[#2c2c2e] text-gray-200 text-sm p-3 rounded-2xl rounded-bl-none max-w-[80%] border border-white/5">
                Hello! I'm Apple Store's AI Assistant. How can I help you today?
            </div>
        </div>
    </div>

    <div class="p-3 border-t border-white/10 bg-[#1c1c1e] rounded-b-2xl">
        <form id="chat-form" class="flex gap-2 relative">
            <input type="text" id="chat-input"
                placeholder="Ask about products, orders, or support..."
                class="flex-1 bg-[#2c2c2e] border border-transparent focus:border-blue-500 rounded-full pl-4 pr-10 py-3 text-sm text-white outline-none transition-all">
            <button type="submit"
                class="absolute right-1 top-1 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white hover:bg-blue-500 transition-colors">
                <i class="fas fa-paper-plane text-xs"></i>
            </button>
        </form>
    </div>
</div>`;
        document.body.appendChild(wrapper);
    }

    // ── Toggle open/close ────────────────────────────────────────────────────
    function toggle() {
        const win = document.getElementById('chat-window');
        if (!win) return;
        if (win.classList.contains('hidden')) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.remove('opacity-0', 'translate-y-10'), 10);
        } else {
            win.classList.add('opacity-0', 'translate-y-10');
            setTimeout(() => win.classList.add('hidden'), 300);
        }
    }

    // ── Append message ───────────────────────────────────────────────────────
    function appendMessage(data, sender) {
        const container = document.getElementById('chat-messages');
        if (!container) return;
        const div = document.createElement('div');

        if (sender === 'user') {
            div.className = 'flex gap-2 items-end justify-end';
            const text = typeof data === 'string' ? data : (data.reply || data);
            div.innerHTML = `<div class="bg-blue-600 text-white text-sm p-3 rounded-2xl rounded-br-none max-w-[80%]">${text}</div>`;
        } else {
            if (typeof data === 'object' && data.type === 'product_card') {
                div.className = 'flex flex-col gap-2 w-full';
                div.innerHTML = renderProductCards(data);
            } else {
                div.className = 'flex gap-2 items-end';
                const text = typeof data === 'string' ? data : (data.reply || '');
                const formatted = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
                div.innerHTML = `
                    <div class="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-red-500 flex items-center justify-center flex-shrink-0">
                        <i class="fas fa-sparkles text-[10px] text-white"></i>
                    </div>
                    <div class="bg-[#2c2c2e] text-gray-200 text-sm p-3 rounded-2xl rounded-bl-none max-w-[80%] border border-white/5 leading-relaxed shadow-sm">${formatted}</div>`;
            }
        }

        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    // ── Loading indicator ────────────────────────────────────────────────────
    function appendLoading(id) {
        const container = document.getElementById('chat-messages');
        if (!container) return;
        const div = document.createElement('div');
        div.id = id;
        div.className = 'flex gap-2 items-end';
        div.innerHTML = `
            <div class="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                <i class="fas fa-robot text-[10px] text-white"></i>
            </div>
            <div class="bg-[#2c2c2e] p-3 rounded-2xl rounded-bl-none border border-white/5 flex gap-1 items-center h-10">
                <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay:.1s"></span>
                <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay:.2s"></span>
            </div>`;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    // ── Product cards ────────────────────────────────────────────────────────
    function renderProductCards(data) {
        const { products, message } = data;
        let html = `
            <div class="flex gap-2 items-end mb-2">
                <div class="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-red-500 flex items-center justify-center flex-shrink-0">
                    <i class="fas fa-sparkles text-[10px] text-white"></i>
                </div>
                <div class="bg-[#2c2c2e] text-gray-200 text-sm p-3 rounded-2xl rounded-bl-none border border-white/5">
                    ${message || 'Here are the products you searched for:'}
                </div>
            </div>`;

        products.forEach((product, index) => {
            const colors = colorVariants[product.name] || [];
            const defaultColor = colors[0] || null;
            const cardId = `chat-card-${Date.now()}-${index}`;

            html += `
                <div class="bg-gradient-to-br from-[#2c2c2e] to-[#1c1c1e] rounded-2xl p-4 border border-white/10 shadow-lg max-w-[85%] ml-8 mb-2 hover:border-blue-500/30 transition-all" id="${cardId}">
                    <div class="w-full h-32 bg-white/5 rounded-xl mb-3 flex items-center justify-center overflow-hidden">
                        <img src="${defaultColor ? defaultColor.image : product.image}" alt="${product.name}" class="h-full object-contain" id="${cardId}-img">
                    </div>
                    <div class="mb-3">
                        <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">${product.category}</p>
                        <h3 class="text-white font-bold text-base mb-2">${product.name}</h3>
                        <div class="flex items-baseline gap-2">
                            <span class="text-2xl font-bold text-blue-400">${product.priceFormatted}</span>
                            ${product.stock < 5 ? `<span class="text-xs text-orange-400">Only ${product.stock} left</span>` : ''}
                        </div>
                    </div>
                    ${colors.length > 0 ? `
                    <div class="mb-3 pb-3 border-b border-white/10">
                        <p class="text-xs text-gray-400 mb-2">Colors:</p>
                        <div class="flex gap-2 flex-wrap">
                            ${colors.map((c, i) => `
                                <button onclick="window._chatbot.selectColor('${cardId}','${c.image}',this)"
                                    class="w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${i === 0 ? 'border-white ring-2 ring-blue-500' : 'border-gray-600 hover:border-gray-400'}"
                                    style="background-color:${c.hex}" title="${c.name}">
                                </button>`).join('')}
                        </div>
                    </div>` : ''}
                    <div class="flex gap-2">
                        <button onclick="window._chatbot.buy('${product.id}')"
                            ${product.stock === 0 ? 'disabled' : ''}
                            class="${product.stock === 0 ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'} text-white font-bold py-2.5 px-4 rounded-lg transition-all flex items-center justify-center gap-2 flex-1 active:scale-95">
                            <i class="fas fa-shopping-cart text-sm"></i>
                            ${product.stock === 0 ? 'Out of Stock' : 'Buy Now'}
                        </button>
                        <button onclick="window._chatbot.view('${product.id}')"
                            class="bg-white/10 hover:bg-white/20 text-white font-medium py-2.5 px-4 rounded-lg transition-all flex items-center justify-center gap-2 flex-1 active:scale-95">
                            Details
                        </button>
                    </div>
                </div>`;
        });
        return html;
    }

    // ── Color picker ─────────────────────────────────────────────────────────
    function selectColor(cardId, image, btn) {
        const img = document.getElementById(`${cardId}-img`);
        if (img) img.src = image;
        const card = document.getElementById(cardId);
        if (!card) return;
        card.querySelectorAll(`button[onclick^="window._chatbot.selectColor"]`).forEach(b => {
            b.className = 'w-8 h-8 rounded-full border-2 transition-all hover:scale-110 border-gray-600 hover:border-gray-400';
        });
        btn.className = 'w-8 h-8 rounded-full border-2 transition-all hover:scale-110 border-white ring-2 ring-blue-500';
    }

    // ── Buy Now ──────────────────────────────────────────────────────────────
    function buy(productId) {
        if (typeof window.addToCart === 'function') {
            // On store.html — use existing cart
            window.addToCart(productId);
            appendMessage({ type: 'text', reply: '✅ Added to bag! <a href="javascript:void(0)" onclick="window.toggleCart&&window.toggleCart()" class="text-blue-400 underline">View bag →</a>' }, 'ai');
            if (typeof window.toggleCart === 'function') {
                const sidebar = document.getElementById('cart-sidebar');
                if (sidebar && sidebar.classList.contains('translate-x-full')) window.toggleCart();
            }
        } else {
            // Other pages — go to store
            window.location.href = '/store.html';
        }
    }

    // ── View Detail ──────────────────────────────────────────────────────────
    function view(productId) {
        if (typeof window.openProductModal === 'function' && window.allProducts) {
            const product = window.allProducts.find(p => p._id === productId);
            if (product) { window.openProductModal(product); return; }
        }
        window.location.href = '/store.html';
    }

    // ── Streaming bubble ─────────────────────────────────────────────────────
    function appendStreamingBubble() {
        const container = document.getElementById('chat-messages');
        const div = document.createElement('div');
        div.className = 'flex gap-2 items-end';
        const bubble = document.createElement('div');
        bubble.className = 'bg-[#2c2c2e] text-gray-200 text-sm p-3 rounded-2xl rounded-bl-none max-w-[80%] border border-white/5 leading-relaxed shadow-sm';
        bubble.innerHTML = '<span class="_cb-cursor">▋</span>';
        div.innerHTML = `<div class="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-red-500 flex items-center justify-center flex-shrink-0"><i class="fas fa-sparkles text-[10px] text-white"></i></div>`;
        div.appendChild(bubble);
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
        return {
            write(text) {
                bubble.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>') + '<span class="_cb-cursor">▋</span>';
                container.scrollTop = container.scrollHeight;
            },
            finish(text) {
                bubble.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
                container.scrollTop = container.scrollHeight;
            }
        };
    }

    // ── Submit handler ───────────────────────────────────────────────────────
    function onSubmit(e) {
        e.preventDefault();
        const input = document.getElementById('chat-input');
        const submitBtn = document.querySelector('#chat-form button[type="submit"]');
        const msg = input.value.trim();
        if (!msg) return;

        appendMessage(msg, 'user');
        input.value = '';
        if (submitBtn) submitBtn.disabled = true;

        const loadingId = 'ai-loading-' + Date.now();
        appendLoading(loadingId);

        const headers = { 'Content-Type': 'application/json' };
        const token = getToken();
        if (token) headers['token'] = `Bearer ${token}`;

        fetch(`${API}/api/chat/message`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ message: msg, sessionId: getSessionId() }),
        })
        .then(response => {
            const loadingEl = document.getElementById(loadingId);
            if (loadingEl) loadingEl.remove();

            if (!response.ok) {
                if (submitBtn) submitBtn.disabled = false;
                const msgs = {
                    401: '⚠️ Please login for better experience. Chatbot also works as guest.',
                    503: '🔧 AI system under maintenance. Contact: 0962923329',
                };
                appendMessage(msgs[response.status] || '❌ Connection error. Please try again later.', 'ai');
                return;
            }

            const contentType = response.headers.get('content-type') || '';

            // ── SSE streaming path ──────────────────────────────────────────
            if (contentType.includes('text/event-stream')) {
                const stream = appendStreamingBubble();
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let accumulated = '';

                function read() {
                    reader.read().then(({ done, value }) => {
                        if (done) {
                            stream.finish(accumulated);
                            if (submitBtn) submitBtn.disabled = false;
                            return;
                        }
                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop();

                        for (const line of lines) {
                            if (!line.startsWith('data: ')) continue;
                            const payload = line.slice(6).trim();
                            if (payload === '[DONE]') {
                                stream.finish(accumulated);
                                if (submitBtn) submitBtn.disabled = false;
                                return;
                            }
                            try {
                                const json = JSON.parse(payload);
                                if (json.sessionId) saveSessionId(json.sessionId);
                                if (json.text) { accumulated += json.text; stream.write(accumulated); }
                                if (json.error) { stream.finish('❌ ' + json.error); if (submitBtn) submitBtn.disabled = false; return; }
                            } catch (_) {}
                        }
                        read();
                    }).catch(() => {
                        stream.finish(accumulated || '❌ Stream interrupted.');
                        if (submitBtn) submitBtn.disabled = false;
                    });
                }
                read();
                return;
            }

            // ── JSON path (product cards / error fallback) ──────────────────
            return response.json().then(data => {
                if (!data) return;
                if (data.type === 'product_card') {
                    appendMessage(data, 'ai');
                } else if (data.reply && data.reply.trim()) {
                    appendMessage(data.reply, 'ai');
                } else {
                    appendMessage('❓ I didn\'t understand. Try asking about product prices or order status.', 'ai');
                }
            }).finally(() => { if (submitBtn) submitBtn.disabled = false; });
        })
        .catch(() => {
            const loadingEl = document.getElementById(loadingId);
            if (loadingEl) loadingEl.remove();
            appendMessage('📌 Cannot connect to AI. Please check your connection.', 'ai');
            if (submitBtn) submitBtn.disabled = false;
        });
    }

    // ── Init ─────────────────────────────────────────────────────────────────
    function init() {
        inject();
        const form = document.getElementById('chat-form');
        if (form) form.addEventListener('submit', onSubmit);
    }

    // Expose for onclick handlers in injected HTML
    window._chatbot = { toggle, buy, view, selectColor };
    // Also expose legacy names used by store.html's existing code
    window.toggleChatWindow = toggle;
    window.handleBuyNowFromChat = buy;
    window.handleViewDetailFromChat = view;
    window.selectChatCardColor = (cardId, image, btn) => selectColor(cardId, image, btn);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
