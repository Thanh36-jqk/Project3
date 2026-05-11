                           const Cart = require('../models/Cart');
const Product = require('../models/Product');

/**
 * Merges a guest cart (from LocalStorage) into the user's MongoDB cart.
 * If an item exists in both, their quantities are summed.
 * Invalid or deleted products are skipped.
 * 
 * @param {string} userId - The MongoDB User ID
 * @param {Array} guestCartItems - Array of items from frontend { productId, quantity }
 * @returns {Promise<Object>} The updated merged cart
 */
exports.mergeGuestCart = async (userId, guestCartItems) => {
    try {
        if (!guestCartItems || !Array.isArray(guestCartItems) || guestCartItems.length === 0) {
            return await Cart.findOne({ userId });
        }

        let userCart = await Cart.findOne({ userId });
        if (!userCart) {
            userCart = new Cart({ userId, items: [] });
        }

        for (const guestItem of guestCartItems) {
            if (!guestItem.productId || !guestItem.quantity) continue;

            // Authoritative product fetch
            const product = await Product.findById(guestItem.productId);
            if (!product || !product.isActive) continue;

            const existingItemIndex = userCart.items.findIndex(
                item => item.productId && item.productId.toString() === guestItem.productId
            );

            if (existingItemIndex > -1) {
                userCart.items[existingItemIndex].quantity += parseInt(guestItem.quantity);
                userCart.items[existingItemIndex].price = product.price; // Update price to latest
            } else {
                userCart.items.push({
                    productId: product._id,
                    quantity: parseInt(guestItem.quantity),
                    name: product.name,
                    price: product.price,
                    image_url: product.image_url || product.images?.[0] || ''
                });
            }
        }

        await userCart.save();
        return userCart;
    } catch (error) {
        console.error('Cart merge error:', error);
        throw error;
    }
};
