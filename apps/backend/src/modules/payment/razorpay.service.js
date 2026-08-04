const Razorpay = require('razorpay');
const crypto = require('crypto');
const { razorpayKeyId, razorpayKeySecret } = require('../../config/env');

/**
 * Razorpay client.
 *
 * Amounts are stored in whole rupees and converted to paise here, at the single
 * boundary with the gateway.
 */

let client = null;

/** Lazily constructed so the app can boot without payment credentials in dev. */
function getClient() {
    if (!razorpayKeyId || !razorpayKeySecret) {
        const error = new Error('Razorpay is not configured');
        error.code = 'RAZORPAY_NOT_CONFIGURED';
        error.status = 503;
        throw error;
    }
    if (!client) {
        client = new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret });
    }
    return client;
}

exports.createOrder = async (amountInRupees, currency = 'INR', receipt) =>
    getClient().orders.create({
        amount: Math.round(amountInRupees * 100), // paise
        currency,
        receipt: receipt || `receipt_${Date.now()}`,
    });

/**
 * Verify the checkout handshake signature: HMAC-SHA256(order_id|payment_id).
 * Compared in constant time so the secret cannot be recovered by timing.
 */
exports.verifyPaymentSignature = (orderId, paymentId, signature) => {
    if (!razorpayKeySecret || !signature) return false;
    const expected = crypto
        .createHmac('sha256', razorpayKeySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');
    return timingSafeEqualHex(expected, signature);
};

/** Verify a webhook delivery: HMAC-SHA256 over the exact raw request body. */
exports.verifyWebhookSignature = (rawBody, signature, secret) => {
    if (!secret || !signature || !rawBody) return false;
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return timingSafeEqualHex(expected, signature);
};

function timingSafeEqualHex(a, b) {
    const bufA = Buffer.from(String(a), 'hex');
    const bufB = Buffer.from(String(b), 'hex');
    if (bufA.length === 0 || bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}
