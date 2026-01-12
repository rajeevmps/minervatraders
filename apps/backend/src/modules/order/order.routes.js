const express = require('express');
const router = express.Router();
const orderController = require('./order.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');

router.get('/', requireAuth, orderController.getOrders);
router.get('/:id', requireAuth, orderController.getOrderById);

module.exports = router;
