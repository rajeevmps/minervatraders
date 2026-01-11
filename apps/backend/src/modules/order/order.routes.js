const express = require('express');
const router = express.Router();
const orderController = require('./order.controller');
const { protect } = require('../../middlewares/auth.middleware');

router.get('/', protect, orderController.getOrders);
router.get('/:id', protect, orderController.getOrderById);

module.exports = router;
