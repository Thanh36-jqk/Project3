// cart-logic.js
// Shared cart logic for the Apple Store pages

let cart = JSON.parse(localStorage.getItem('apple_cart')) || [];

const formatPriceCart = (price) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);

function toggleCart() {
    const sidebar = document.getElementById('cart-sidebar');
    const overlay = document.getElementById('cart-overlay');
    
    if (!sidebar || !overlay) {
        console.error("Cart sidebar or overlay elements not found.");
        return;
    }

    const isOpen = !sidebar.classList.contains('translate-x-full');

    if (isOpen) {
        sidebar.classList.add('translate-x-full');
        overlay.classList.remove('opacity-100');
        setTimeout(() => overlay.classList.add('hidden'), 300);
    } else {
        overlay.classList.remove('hidden');
        setTimeout(() => {
            sidebar.classList.remove('translate-x-full');
            overlay.classList.add('opacity-100');
        }, 10);
    }
}

async function addToCartGeneric(id, name, price, image) {
    const token = localStorage.getItem('accessToken');
    
    // Convert string price like "21,990,000₫" to number if needed
    let numericPrice = price;
    if (typeof price === 'string') {
        numericPrice = Number(price.replace(/[^\d]/g, ''));
    }

    // Normalize image path
    let normalizedImage = image ? image.replace(/^(\.\.\/)+/, '').replace(/^(\.\/)+/, '') : '';
    if (normalizedImage.startsWith('/')) {
        normalizedImage = normalizedImage.substring(1);
    }

    // 1. If Logged In -> Sync with Backend
    if (token) {
        try {
            const res = await fetch('https://project3-icy1.onrender.com/api/cart/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ productId: id, quantity: 1 })
            });
            if (!res.ok) {
                const data = await res.json();
                if (typeof showToast === 'function') showToast(data.message || 'Error adding to cart', 'error');
                return;
            }
            // Fetch updated cart to keep UI in sync
            const cartRes = await fetch('https://project3-icy1.onrender.com/api/cart', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const cartData = await cartRes.json();
            
            // Map backend schema to frontend structure
            cart = (cartData.items || []).map(item => ({
                productId: item.productId,
                name: item.name,
                price: item.price,
                image: item.image_url,
                quantity: item.quantity
            }));
            saveCart();
            updateCartUI();
        } catch (err) {
            console.error('Error syncing cart:', err);
        }
    } 
    // 2. If Guest -> Save to LocalStorage only
    else {
        const existingItem = cart.find(item => item.productId === id);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({
                productId: id,
                name: name,
                price: numericPrice,
                image: normalizedImage,
                quantity: 1
            });
        }
        saveCart();
        updateCartUI();
    }

    if (typeof showToast === 'function') {
        showToast(`Added ${name} to bag`);
    }

    // Auto open cart
    const sidebar = document.getElementById('cart-sidebar');
    if (sidebar && sidebar.classList.contains('translate-x-full')) {
        toggleCart();
    }
}

function saveCart() {
    localStorage.setItem('apple_cart', JSON.stringify(cart));
}

function updateCartUI() {
    const container = document.getElementById('cart-items-container');
    const badge = document.getElementById('cart-badge');
    const headerCount = document.getElementById('cart-count-header');
    const subtotalEl = document.getElementById('cart-subtotal');
    const checkoutTotal = document.getElementById('checkout-total'); // Might not exist on all pages

    if (!container) return; // Prevent errors if UI is missing

    container.innerHTML = '';

    let totalQty = 0;
    let totalPrice = 0;

    // Determine base path based on current location
    let basePath = '';
    const currentPath = window.location.pathname;
    if (currentPath.includes('/pages/products/') || currentPath.includes('/pages/auth/') || currentPath.includes('/pages/admin/')) {
        basePath = '../../';
    }

    if (cart.length === 0) {
        container.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                <i class="fas fa-shopping-basket text-6xl mb-4 text-white"></i>
                <p class="text-white">Your bag is empty.</p>
                <button onclick="toggleCart()" class="text-blue-500 hover:underline">Start Shopping</button>
            </div>`;
    } else {
        cart.forEach((item, index) => {
            totalQty += item.quantity;
            totalPrice += item.price * item.quantity;

            container.innerHTML += `
                <div class="flex gap-4 bg-[#2c2c2e] p-3 rounded-xl">
                    <div class="w-20 h-20 bg-white rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                        <img src="${item.image && (item.image.startsWith('http') || item.image.startsWith('data:')) ? item.image : basePath + item.image}" class="w-full h-full object-contain">
                    </div>
                    <div class="flex-1 flex flex-col justify-between">
                        <div>
                            <h4 class="text-sm font-bold text-white line-clamp-1">${item.name}</h4>
                            ${item.color ? `<p class="text-gray-400 text-xs mt-0.5">Color: ${item.color}</p>` : ''}
                            <p class="text-blue-400 text-xs mt-1 font-mono">${formatPriceCart(item.price)}</p>
                        </div>
                        <div class="flex justify-between items-center mt-2">
                            <div class="flex items-center gap-3 bg-[#1c1c1e] rounded px-2 py-1">
                                <button onclick="updateQty(${index}, -1)" class="text-gray-400 hover:text-white">-</button>
                                <span class="text-xs font-medium w-4 text-center text-white">${item.quantity}</span>
                                <button onclick="updateQty(${index}, 1)" class="text-gray-400 hover:text-white">+</button>
                            </div>
                            <button onclick="removeCartItem(${index})" class="text-xs text-red-400 hover:text-red-300">Remove</button>
                        </div>
                    </div>
                </div>
            `;
        });
    }

    // Update Summaries
    if (badge) {
        badge.textContent = totalQty;
        badge.style.opacity = totalQty > 0 ? '1' : '0';
    }
    if (headerCount) {
        headerCount.textContent = `(${totalQty} items)`;
    }
    if (subtotalEl) {
        subtotalEl.textContent = formatPriceCart(totalPrice);
    }
    if (checkoutTotal) {
        checkoutTotal.textContent = formatPriceCart(totalPrice);
    }
}

// Attach these to window so inline onclick handlers work
window.updateQty = (index, change) => {
    cart[index].quantity += change;
    if (cart[index].quantity <= 0) cart.splice(index, 1);
    saveCart();
    updateCartUI();
};

window.removeCartItem = (index) => {
    cart.splice(index, 1);
    saveCart();
    updateCartUI();
};

window.openCheckoutCart = () => {
    // Determine path back to store.html checkout block if needed, or simply alert
    alert('Proceeding to checkout with ' + cart.length + ' types of items!');
};

// Initialize Cart UI on load
document.addEventListener('DOMContentLoaded', () => {
    updateCartUI();
});
