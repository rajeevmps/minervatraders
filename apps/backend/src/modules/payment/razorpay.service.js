const Razorpay = require('razorpay');
const crypto = require('crypto');
const { razorpayKeyId, razorpayKeySecret } = require('../../config/env');

const razorpay = new Razorpay({
    key_id: razorpayKeyId,
    key_secret: razorpayKeySecret,
});

exports.createOrder = async (amount, currency = 'INR', receipt) => {
    const options = {
        amount: amount * 100, // amount in smallest currency unit
        currency,
        receipt: receipt || `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    return order;
};

exports.verifyPaymentSignature = (orderId, paymentId, signature) => {
    const text = orderId + '|' + paymentId;
    const generated_signature = crypto
        .createHmac('sha256', razorpayKeySecret)
        .update(text.toString())
        .digest('hex');

    return generated_signature === signature;
};
