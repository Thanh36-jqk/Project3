const express = require('express');
const returnController = require('../controllers/returnController');
const { verifyToken, verifyAdmin } = require('../middleware/auth');

// Mounted at /api/orders/:id/return  (mergeParams: true to access :id)
const orderReturnRouter = express.Router({ mergeParams: true });
orderReturnRouter.post('/', verifyToken, returnController.createReturnRequest);
orderReturnRouter.get('/',             returnController.getOrderReturnRequest);

// Mounted at /api/admin/returns
const adminReturnRouter = express.Router();
adminReturnRouter.get('/',         verifyAdmin, returnController.getReturnRequests);
adminReturnRouter.put('/:id/status', verifyAdmin, returnController.updateReturnStatus);

module.exports = { orderReturnRouter, adminReturnRouter };
