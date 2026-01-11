const express = require('express');
const router = express.Router();
const razorpayController = require('./razorpay.controller');
const webhookController = require('./webhook.controller');
const { protect } = require('../../middlewares/auth.middleware');

router.post('/create-order', protect, razorpayController.createOrder);
router.post('/verify', protect, razorpayController.verifyPayment);
router.post('/webhook', webhookController.handleWebhook);

module.exports = router;
