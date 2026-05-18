const express = require('express');
const router = express.Router();
const addressController = require('../controllers/addressController');
const { verifyToken } = require('../middleware/auth');

router.get('/', verifyToken, addressController.getAddresses);
router.post('/', verifyToken, addressController.createAddress);
router.put('/:id', verifyToken, addressController.updateAddress);
router.delete('/:id', verifyToken, addressController.deleteAddress);
router.put('/:id/default', verifyToken, addressController.setDefaultAddress);

module.exports = router;
