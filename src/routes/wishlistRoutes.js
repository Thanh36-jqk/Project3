const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/wishlistController');
const { verifyToken } = require('../middleware/auth');

// All wishlist routes require authentication
router.get('/', verifyToken, wishlistController.getWishlist);
router.post('/add', verifyToken, wishlistController.addToWishlist);
router.delete('/remove/:productId', verifyToken, wishlistController.removeFromWishlist);

module.exports = router;
