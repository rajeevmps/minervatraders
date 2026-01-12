const { z } = require('zod');

exports.createOrderSchema = {
    body: z.object({
        planId: z.string().uuid('Invalid Plan ID format')
    })
};

exports.verifyPaymentSchema = {
    body: z.object({
        orderId: z.string().min(1, 'Razorpay Order ID is required'),
        paymentId: z.string().min(1, 'Razorpay Payment ID is required'),
        signature: z.string().min(1, 'Razorpay Signature is required')
    })
};
