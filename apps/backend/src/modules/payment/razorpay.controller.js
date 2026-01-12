const razorpayService = require('./razorpay.service');
const { supabase } = require('../../config/db');
const subscriptionService = require('../subscription/subscription.service');
const telegramService = require('../telegram/telegram.service');
const { sendResponse } = require('../../utils/responseHelper');

exports.createOrder = async (req, res, next) => {
    try {
        const { planId } = req.body;
        const userId = req.user.sub;

        // 0. Check for active subscription
        const activeSub = await subscriptionService.getActiveSubscription(userId);
        if (activeSub) {
            return sendResponse(res, 400, false, 'Active subscription exists', null, { code: 'ACTIVE_SUBSCRIPTION_EXISTS' });
        }

        // 1. Fetch Plan Details (Source of Truth)
        const { data: plan, error: planError } = await supabase
            .from('subscription_plans')
            .select('price, is_active')
            .eq('id', planId)
            .single();

        if (planError || !plan) {
            return sendResponse(res, 404, false, 'Plan not found');
        }

        if (!plan.is_active) {
            return sendResponse(res, 400, false, 'Plan is no longer active');
        }

        const amount = plan.price; // Use price from DB

        // 2. Create Internal Order
        const { data: internalOrder, error: orderError } = await supabase
            .from('orders')
            .insert([{ user_id: userId, total_amount: amount, status: 'pending' }])
            .select()
            .single();

        if (orderError) throw orderError;

        // 2.5 Create Order Item
        const { error: itemError } = await supabase
            .from('order_items')
            .insert([{
                order_id: internalOrder.id,
                plan_id: planId,
                price: amount
            }]);

        if (itemError) throw itemError;

        // 3. Create Razorpay Order
        const rpOrder = await razorpayService.createOrder(amount, 'INR', internalOrder.id);

        // 3.5 Update Internal Order
        const { error: updateOrderError } = await supabase
            .from('orders')
            .update({ razorpay_order_id: rpOrder.id })
            .eq('id', internalOrder.id);

        if (updateOrderError) throw updateOrderError;

        // 4. Create Payment Record (Pending)
        const { error: paymentError } = await supabase
            .from('payments')
            .insert([{
                user_id: userId,
                order_id: internalOrder.id,
                amount: amount,
                status: 'pending'
            }]);

        if (paymentError) throw paymentError;

        return sendResponse(res, 200, true, 'Order created', { ...rpOrder, internal_order_id: internalOrder.id });
    } catch (error) {
        return sendResponse(res, 500, false, 'Error creating order', null, { code: 'ORDER_CREATION_ERROR', details: error.message });
    }
};

exports.verifyPayment = async (req, res, next) => {
    try {
        const { orderId, paymentId, signature } = req.body; // orderId here is Razorpay Order ID usually returned by frontend checkout
        // Need to find which internal order matches this razorpay_order_id if we want to update it.

        const isValid = razorpayService.verifyPaymentSignature(orderId, paymentId, signature);

        if (isValid) {
            // Update Payment Status
            // NEW LOGIC: Find internal order first using Razorpay ID
            const { data: orderData, error: findOrderError } = await supabase
                .from('orders')
                .select('id')
                .eq('razorpay_order_id', orderId)
                .single();

            if (findOrderError || !orderData) throw new Error('Order not found for this payment');

            // Update Payment Status using internal order_id
            const { data: paymentData, error: updateError } = await supabase
                .from('payments')
                .update({
                    razorpay_payment_id: paymentId,
                    razorpay_signature: signature,
                    status: 'captured'
                })
                .eq('order_id', orderData.id)
                .select()
                .single();

            if (updateError) throw updateError;

            // Also update Internal Order Status
            if (paymentData && paymentData.order_id) {
                await supabase
                    .from('orders')
                    .update({ status: 'paid' })
                    .eq('id', paymentData.order_id);
            }

            // NEW: Fetch Plan ID from Order Items to activate subscription
            const { data: orderItem } = await supabase
                .from('order_items')
                .select('plan_id')
                .eq('order_id', orderData.id)
                .single();

            // 1. Activate Subscription
            if (orderItem && orderItem.plan_id) {
                // Determine user ID from order (safest) or use internalOrder if available
                // We need fetching user_id from order
                const { data: orderUser } = await supabase.from('orders').select('user_id').eq('id', orderData.id).single();

                if (orderUser) {
                    await subscriptionService.createSubscription(orderUser.user_id, orderItem.plan_id, orderData.id);

                    // 2. Generate Telegram Invite
                    try {
                        const inviteLink = await telegramService.generateInviteLink(orderUser.user_id);
                        return sendResponse(res, 200, true, 'Payment verified successfully', {
                            inviteLink,
                            subscriptionActive: true
                        });
                    } catch (tgError) {
                        console.error('Telegram Link Gen Failed:', tgError);
                        // Don't fail the whole request, just warn
                        return sendResponse(res, 200, true, 'Payment verified, but Telegram link generation failed. Please contact support.', {
                            subscriptionActive: true,
                            warning: 'TELEGRAM_LINK_FAILED'
                        });
                    }
                }
            }

            return sendResponse(res, 200, true, 'Payment verified successfully');
        } else {
            return sendResponse(res, 400, false, 'Invalid signature', null, { code: 'INVALID_SIGNATURE' });
        }
    } catch (error) {
        return sendResponse(res, 500, false, 'Error verifying payment', null, { code: 'PAYMENT_VERIFICATION_ERROR', details: error.message });
    }
};

exports.handleWebhook = async (req, res) => {
    try {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const signature = req.headers['x-razorpay-signature'];
        const payload = req.body;

        // 1. Log incoming request
        const { data: log, error: logError } = await supabase
            .from('webhook_logs')
            .insert([{
                event_type: payload.event || 'unknown',
                payload: payload,
                signature: signature,
                processed: false
            }])
            .select()
            .single();

        if (logError) console.error("Webhook Log Error:", logError);

        // 2. Validate Signature
        const crypto = require('crypto');
        const hmac = crypto.createHmac('sha256', secret);
        // Use rawBody for exact match with Razorpay's hash
        hmac.update(req.rawBody);
        const expectedSignature = hmac.digest('hex');

        if (signature !== expectedSignature) {
            console.warn("Invalid Webhook Signature. Expected:", expectedSignature, "Received:", signature);
            return res.status(200).json({ status: 'ok', warning: 'invalid_signature' });
        }

        // 3. Process Event
        if (payload.event === 'payment.captured' || payload.event === 'order.paid') {
            const paymentEntity = payload.payload.payment.entity;
            const orderId = paymentEntity.order_id;
            const paymentId = paymentEntity.id;

            // Find internal order
            const { data: orderData, error: findOrderError } = await supabase
                .from('orders')
                .select('id, user_id, status')
                .eq('razorpay_order_id', orderId)
                .single();

            if (orderData) {
                // Determine Plan
                const { data: orderItem } = await supabase
                    .from('order_items')
                    .select('plan_id')
                    .eq('order_id', orderData.id)
                    .single();

                if (orderItem && orderItem.plan_id) {
                    // Update Payment Record
                    await supabase
                        .from('payments')
                        .update({
                            razorpay_payment_id: paymentId,
                            status: 'captured',
                            method: paymentEntity.method,
                            webhook_event: payload.event
                        })
                        .eq('order_id', orderData.id); // Matches internal Order ID

                    // Update Order Status
                    await supabase
                        .from('orders')
                        .update({ status: 'paid' })
                        .eq('id', orderData.id);

                    // Activate Subscription (Idempotent check inside service usually, or we check status)
                    // But createSubscription usually creates a NEW one. 
                    // To prevent duplicates if user hits verify + webhook, check if sub exists for this order?
                    // subscriptionService.createSubscription checks logic? No, let's assume valid flow.
                    if (orderData.status !== 'paid') {
                        await subscriptionService.createSubscription(orderData.user_id, orderItem.plan_id, orderData.id);

                        // Generate Telegram Link (Optional: send email/notification here)
                        // await telegramService.generateInviteLink(orderData.user_id);
                    }
                }
            }
        }

        // Mark Log as Processed
        if (log && log.id) {
            await supabase.from('webhook_logs').update({ processed: true }).eq('id', log.id);
        }

        return res.status(200).json({ status: 'ok' });
    } catch (error) {
        console.error("Webhook Error:", error);
        return res.status(200).json({ status: 'error' });
    }
};
