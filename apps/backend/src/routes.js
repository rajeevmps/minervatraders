const express = require('express');
const router = express.Router();

const authRoutes = require('./modules/auth/auth.routes');
const userRoutes = require('./modules/user/user.routes');
const subscriptionRoutes = require('./modules/subscription/subscription.routes');
const addressRoutes = require('./modules/address/address.routes');
const orderRoutes = require('./modules/order/order.routes');
const paymentRoutes = require('./modules/payment/razorpay.routes');
const telegramRoutes = require('./modules/telegram/telegram.routes');
const adminRoutes = require('./modules/admin/admin.routes');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/address', addressRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);
router.use('/telegram', telegramRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
