const razorpayService = require('./razorpay.service');
const { supabase } = require('../../config/db');
const subscriptionService = require('../subscription/subscription.service');
const telegramService = require('../telegram/telegram.service');

exports.createOrder = async (req, res, next) => {
    try {
        const { amount, planId } = req.body;
        const userId = req.user.id;

        // 0. Check for active subscription to prevent duplicates
        const activeSub = await subscriptionService.getActiveSubscription(userId);
        if (activeSub) {
            return res.status(400).json({
                message: 'You already have an active subscription. You cannot purchase a new plan until the current one expires.'
            });
        }

        // 1. Create Internal Order
        const { data: internalOrder, error: orderError } = await supabase
            .from('orders')
            .insert([{ user_id: userId, total_amount: amount, status: 'pending' }])
            .select()
            .single();

        if (orderError) throw orderError;

        // 1.5 Create Order Item to track Plan
        const { error: itemError } = await supabase
            .from('order_items')
            .insert([{
                order_id: internalOrder.id,
                plan_id: planId, // Storing plan_id is crucial for webhook
                price: amount
            }]);

        if (itemError) throw itemError;

        // 2. Create Razorpay Order
        const rpOrder = await razorpayService.createOrder(amount, 'INR', internalOrder.id);

        // 2.5 Update Internal Order with Razorpay Order ID
        const { error: updateOrderError } = await supabase
            .from('orders')
            .update({ razorpay_order_id: rpOrder.id })
            .eq('id', internalOrder.id);

        if (updateOrderError) throw updateOrderError;

        // 3. Create Payment Record
        const { error: paymentError } = await supabase
            .from('payments')
            .insert([{
                user_id: userId,
                order_id: internalOrder.id,
                amount: amount,
                status: 'pending'
            }]);

        if (paymentError) throw paymentError;

        res.status(200).json({ ...rpOrder, internal_order_id: internalOrder.id });
    } catch (error) {
        next(error);
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
                .update({ razorpay_payment_id: paymentId, signature: signature, status: 'paid' })
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
                        return res.status(200).json({
                            message: 'Payment verified successfully',
                            inviteLink,
                            subscriptionActive: true
                        });
                    } catch (tgError) {
                        console.error('Telegram Link Gen Failed:', tgError);
                        // Don't fail the whole request, just warn
                        return res.status(200).json({
                            message: 'Payment verified, but Telegram link generation failed. Please contact support.',
                            subscriptionActive: true
                        });
                    }
                }
            }

            res.status(200).json({ message: 'Payment verified successfully' });
        } else {
            res.status(400).json({ message: 'Invalid signature' });
        }
    } catch (error) {
        next(error);
    }
};
