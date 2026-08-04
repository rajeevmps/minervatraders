const db = require('../../config/db');
const razorpayService = require('./razorpay.service');
const subscriptionService = require('../subscription/subscription.service');
const telegramService = require('../telegram/telegram.service');
const { sendResponse } = require('../../utils/responseHelper');
const { razorpayWebhookSecret } = require('../../config/env');
const logger = require('../../utils/logger');

/**
 * Razorpay payment flow.
 *
 * The checkout callback (verifyPayment) and the webhook (handleWebhook) can
 * both arrive for the same order, in either order, possibly concurrently. Both
 * therefore funnel into ONE idempotent fulfilment routine rather than each
 * activating a subscription independently as they did previously.
 */

exports.createOrder = async (req, res, next) => {
    try {
        const { planId } = req.body;
        const userId = req.user.sub;

        const activeSub = await subscriptionService.getActiveSubscription(userId);
        if (activeSub) {
            return sendResponse(res, 409, false, 'You already have an active subscription', null, {
                code: 'ACTIVE_SUBSCRIPTION_EXISTS',
            });
        }

        // Price comes from the database, never from the request body.
        const plan = await db.one(
            `SELECT id, price, sale_price, currency, is_active
               FROM subscription_plans WHERE id = $1`,
            [planId]
        );

        if (!plan) {
            return sendResponse(res, 404, false, 'Plan not found', null, { code: 'PLAN_NOT_FOUND' });
        }
        if (!plan.is_active) {
            return sendResponse(res, 400, false, 'This plan is no longer available', null, {
                code: 'PLAN_INACTIVE',
            });
        }

        const amount = plan.sale_price ?? plan.price;

        // Order, line item and pending payment are written together: a partial
        // failure previously left orphaned orders with no items.
        const internalOrder = await db.tx(async (t) => {
            const order = await t.one(
                `INSERT INTO orders (user_id, total_amount, currency, status)
                 VALUES ($1, $2, $3, 'pending')
                 RETURNING id, total_amount, currency`,
                [userId, amount, plan.currency]
            );

            await t.query(
                `INSERT INTO order_items (order_id, plan_id, price) VALUES ($1, $2, $3)`,
                [order.id, planId, amount]
            );

            await t.query(
                `INSERT INTO payments (user_id, order_id, amount, currency, status)
                 VALUES ($1, $2, $3, $4, 'pending')`,
                [userId, order.id, amount, plan.currency]
            );

            return order;
        });

        // Calling the gateway outside the transaction avoids holding a database
        // connection open across a network round trip.
        const rpOrder = await razorpayService.createOrder(
            amount,
            plan.currency,
            internalOrder.id
        );

        await db.query(`UPDATE orders SET razorpay_order_id = $2 WHERE id = $1`, [
            internalOrder.id,
            rpOrder.id,
        ]);

        return sendResponse(res, 201, true, 'Order created', {
            ...rpOrder,
            internal_order_id: internalOrder.id,
        });
    } catch (error) {
        return next(error);
    }
};

exports.verifyPayment = async (req, res, next) => {
    try {
        const { orderId, paymentId, signature } = req.body;

        if (!razorpayService.verifyPaymentSignature(orderId, paymentId, signature)) {
            logger.warn('Rejected payment with invalid signature', { orderId });
            return sendResponse(res, 400, false, 'Invalid payment signature', null, {
                code: 'INVALID_SIGNATURE',
            });
        }

        const order = await db.one(
            `SELECT id, user_id FROM orders WHERE razorpay_order_id = $1`,
            [orderId]
        );
        if (!order) {
            return sendResponse(res, 404, false, 'Order not found', null, {
                code: 'ORDER_NOT_FOUND',
            });
        }

        // The signed-in user must own the order they are confirming.
        if (order.user_id !== req.user.sub) {
            logger.warn('User attempted to verify an order they do not own', {
                userId: req.user.sub,
                orderId: order.id,
            });
            return sendResponse(res, 403, false, 'Order does not belong to this account', null, {
                code: 'FORBIDDEN',
            });
        }

        const result = await fulfillOrder(order.id, {
            paymentId,
            signature,
            source: 'checkout',
        });

        let inviteLink = null;
        try {
            inviteLink = await telegramService.generateInviteLink(order.user_id);
        } catch (error) {
            // Payment succeeded; a Telegram outage must not present as failure.
            logger.error('Invite generation failed after payment', {
                userId: order.user_id,
                error: error.message,
            });
        }

        return sendResponse(res, 200, true, 'Payment verified', {
            subscriptionActive: true,
            alreadyProcessed: !result.activated,
            inviteLink,
            warning: inviteLink ? undefined : 'TELEGRAM_LINK_FAILED',
        });
    } catch (error) {
        return next(error);
    }
};

exports.handleWebhook = async (req, res) => {
    const signature = req.get('x-razorpay-signature');

    // Verify BEFORE recording anything, so unauthenticated callers cannot fill
    // the log table with arbitrary rows.
    if (!razorpayService.verifyWebhookSignature(req.rawBody, signature, razorpayWebhookSecret)) {
        logger.warn('Rejected Razorpay webhook with invalid signature', { ip: req.ip });
        return res.status(401).json({ status: 'unauthorized' });
    }

    const payload = req.body;
    const eventId = req.get('x-razorpay-event-id') || null;

    try {
        // A UNIQUE index on (provider, event_id) makes redelivery a no-op.
        const log = await db.one(
            `INSERT INTO webhook_logs (provider, event_type, event_id, payload, signature)
             VALUES ('razorpay', $1, $2, $3, $4)
             ON CONFLICT (provider, event_id) WHERE event_id IS NOT NULL DO NOTHING
             RETURNING id`,
            [payload.event || 'unknown', eventId, payload, signature]
        );

        if (!log) {
            logger.info('Duplicate Razorpay webhook ignored', { eventId });
            return res.status(200).json({ status: 'ok', duplicate: true });
        }

        if (payload.event === 'payment.captured' || payload.event === 'order.paid') {
            const entity = payload.payload?.payment?.entity;
            if (entity) {
                const order = await db.one(
                    `SELECT id FROM orders WHERE razorpay_order_id = $1`,
                    [entity.order_id]
                );
                if (order) {
                    await fulfillOrder(order.id, {
                        paymentId: entity.id,
                        method: entity.method,
                        event: payload.event,
                        source: 'webhook',
                    });
                } else {
                    logger.warn('Webhook for unknown order', { razorpayOrderId: entity.order_id });
                }
            }
        }

        await db.query(`UPDATE webhook_logs SET processed = TRUE WHERE id = $1`, [log.id]);
        return res.status(200).json({ status: 'ok' });
    } catch (error) {
        logger.error('Razorpay webhook processing failed', { error: error.message, eventId });
        if (eventId) {
            await db
                .query(`UPDATE webhook_logs SET error = $2 WHERE event_id = $1`, [
                    eventId,
                    error.message,
                ])
                .catch(() => {});
        }
        // 200 keeps Razorpay from retrying a payload we will never process
        // successfully; the row above records it for manual follow-up.
        return res.status(200).json({ status: 'error' });
    }
};

/**
 * Mark an order paid and activate its subscription — exactly once.
 *
 * The conditional UPDATE is the concurrency guard: only the caller whose
 * statement actually transitions the row out of 'pending' gets a row back, so
 * simultaneous checkout and webhook deliveries cannot both activate.
 *
 * @returns {Promise<{activated: boolean}>}
 */
async function fulfillOrder(orderId, { paymentId, signature, method, event, source }) {
    return db.tx(async (t) => {
        const claimed = await t.one(
            `UPDATE orders SET status = 'paid'
              WHERE id = $1 AND status <> 'paid'
          RETURNING id, user_id`,
            [orderId]
        );

        // Record payment details regardless of who won the race, so the row
        // reflects reality even on the losing path.
        await t.query(
            `UPDATE payments
                SET razorpay_payment_id = COALESCE($2, razorpay_payment_id),
                    razorpay_signature  = COALESCE($3, razorpay_signature),
                    method              = COALESCE($4, method),
                    webhook_event       = COALESCE($5, webhook_event),
                    status              = 'captured'
              WHERE order_id = $1`,
            [orderId, paymentId || null, signature || null, method || null, event || null]
        );

        if (!claimed) {
            logger.info('Order already fulfilled; skipping activation', { orderId, source });
            return { activated: false };
        }

        const item = await t.one(`SELECT plan_id FROM order_items WHERE order_id = $1 LIMIT 1`, [
            orderId,
        ]);
        if (!item) {
            throw new Error(`Order ${orderId} has no line item; cannot activate a subscription`);
        }

        await t.query(
            `UPDATE user_subscriptions SET status = 'expired'
              WHERE user_id = $1 AND status = 'active'`,
            [claimed.user_id]
        );

        await t.one(
            `INSERT INTO user_subscriptions (user_id, plan_id, order_id, start_date, end_date, status)
             SELECT $1, p.id, $2, now(), now() + make_interval(days => p.duration_days), 'active'
               FROM subscription_plans p
              WHERE p.id = $3
          RETURNING id`,
            [claimed.user_id, orderId, item.plan_id]
        );

        logger.info('Subscription activated', { userId: claimed.user_id, orderId, source });
        return { activated: true };
    });
}

exports.fulfillOrder = fulfillOrder;
