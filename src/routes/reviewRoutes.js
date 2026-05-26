const express = require('express');
const router = express.Router({ mergeParams: true });
const reviewController = require('../controllers/reviewController');
const { verifyToken } = require('../middleware/auth');

// GET /api/products/:id/reviews/my — must be before '/' to avoid conflict
router.get('/my', verifyToken, reviewController.checkMyReview);

// GET /api/products/:id/reviews
router.get('/', reviewController.getReviews);

// POST /api/products/:id/reviews (authenticated)
router.post('/', verifyToken, reviewController.createReview);

module.exports = router;
