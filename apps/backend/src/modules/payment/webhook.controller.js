const crypto = require('crypto');
const { razorpayWebhookSecret } = require('../../config/env');
const { supabase } = require('../../config/db');
const subscriptionService = require('../subscription/subscription.service');
const telegramService = require('../telegram/telegram.service');

exports.handleWebhook = async (req, res) => {
    console.log('--- Webhook Received ---');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));

    const secret = razorpayWebhookSecret;

    const shasum = crypto.createHmac('sha256', secret);
    shasum.update(req.rawBody);
    const digest = shasum.digest('hex');

    const signature = req.headers['x-razorpay-signature'];

    console.log('Digest:', digest);
    console.log('Signature Header:', signature);

    if (digest !== signature) {
        console.error('Webhook signature mismatch!');
        return res.status(400).json({ status: 'error', message: 'Invalid signature' });
    }

    console.log('Webhook signature verified');

    // Idempotency Check using webhook_logs table
    const { data: existingLog } = await supabase
        .from('webhook_logs')
        .select('id')
        .eq('signature', signature)
        .single();

    if (existingLog) {
        return res.status(200).json({ status: 'ignored', message: 'Already processed' });
    }

    const event = req.body.event;

    try {
        // Log Webhook Start
        await supabase.from('webhook_logs').insert([{
            event_type: event,
            payload: req.body,
            signature: signature
        }]);

        if (event === 'payment.captured') {
            const { id: paymentId, order_id: rzOrderId } = req.body.payload.payment.entity;

            // 1. Find Internal Order
            const { data: internalOrder } = await supabase
                .from('orders')
                .select('id, user_id')
                .eq('razorpay_order_id', rzOrderId)
                .single();

            if (!internalOrder) {
                console.error(`Webhook: Order not found for ${rzOrderId}`);
                return res.status(200).json({ status: 'ignored' });
            }

            // 2. Update Records
            await supabase.from('payments').update({ razorpay_payment_id: paymentId, status: 'paid' }).eq('order_id', internalOrder.id);
            await supabase.from('orders').update({ status: 'paid' }).eq('id', internalOrder.id);

            // 3. Activate Subscription
            const { data: orderItem } = await supabase.from('order_items').select('plan_id').eq('order_id', internalOrder.id).single();

            if (orderItem && orderItem.plan_id) {
                await subscriptionService.createSubscription(internalOrder.user_id, orderItem.plan_id, internalOrder.id);

                // 4. Generate Link (Ready for user to click "Join" on dashboard)
                await telegramService.generateInviteLink(internalOrder.user_id);
            }
        }

        res.status(200).json({ status: 'ok' });
    } catch (error) {
        console.error('Webhook Error:', error);
        res.status(500).json({ status: 'error' });
    }
};
