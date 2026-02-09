const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { verifyAdmin } = require('../middleware/auth');

// Public routes
router.get('/search', productController.searchProducts);
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);

// Admin routes
router.post('/', verifyAdmin, productController.createProduct);
router.put('/:id', verifyAdmin, productController.updateProduct);
router.put('/:id/stock', verifyAdmin, productController.updateStock);
router.delete('/:id', verifyAdmin, productController.deleteProduct);

module.exports = router;
