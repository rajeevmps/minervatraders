const express = require('express');
const router = express.Router();
const razorpayController = require('./razorpay.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate');
const { createOrderSchema, verifyPaymentSchema } = require('./razorpay.schema');

router.post('/create-order', requireAuth, validate(createOrderSchema), razorpayController.createOrder);
router.post('/verify', requireAuth, validate(verifyPaymentSchema), razorpayController.verifyPayment);

// Webhook handler (No Auth Middleware - verified by signature)
router.post('/webhook', razorpayController.handleWebhook);

module.exports = router;
