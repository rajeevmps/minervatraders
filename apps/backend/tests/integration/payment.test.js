const request = require('supertest');
const crypto = require('crypto');

const app = require('../../src/app');
const db = require('../../src/config/db');
const { fulfillOrder } = require('../../src/modules/payment/razorpay.controller');
const { createUser, createPlan, createOrder, createSubscription } = require('../helpers/factories');
const { createAndSignIn } = require('../helpers/auth');

/**
 * Payment verification, webhook handling, and fulfilment idempotency.
 *
 * The checkout callback and the webhook can both arrive for the same order, in
 * any order and concurrently. Exactly one subscription must result.
 */

jest.mock('../../src/modules/telegram/telegram.service', () => ({
    generateInviteLink: jest.fn().mockResolvedValue('https://t.me/+fake-invite'),
    revokeAccess: jest.fn().mockResolvedValue(undefined),
    sendMessage: jest.fn().mockResolvedValue(undefined),
    approveJoinRequest: jest.fn().mockResolvedValue(undefined),
    declineJoinRequest: jest.fn().mockResolvedValue(undefined),
    invalidateConfigCache: jest.fn(),
}));

const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

const checkoutSignature = (orderId, paymentId) =>
    crypto.createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');

const webhookSignature = (body) =>
    crypto.createHmac('sha256', WEBHOOK_SECRET).update(JSON.stringify(body)).digest('hex');

const capturedEvent = (razorpayOrderId, paymentId = 'pay_TEST1') => ({
    event: 'payment.captured',
    payload: { payment: { entity: { id: paymentId, order_id: razorpayOrderId, method: 'upi' } } },
});

describe('POST /api/v1/payments/verify', () => {
    it('rejects an invalid signature', async () => {
        const { accessToken, dbUser } = await createAndSignIn();
        const plan = await createPlan();
        await createOrder({ userId: dbUser.id, planId: plan.id, razorpayOrderId: 'order_A' });

        const res = await request(app)
            .post('/api/v1/payments/verify')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ orderId: 'order_A', paymentId: 'pay_1', signature: 'not-the-right-signature' });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('INVALID_SIGNATURE');
    });

    it('does not activate anything when the signature is invalid', async () => {
        const { accessToken, dbUser } = await createAndSignIn();
        const plan = await createPlan();
        await createOrder({ userId: dbUser.id, planId: plan.id, razorpayOrderId: 'order_B' });

        await request(app)
            .post('/api/v1/payments/verify')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ orderId: 'order_B', paymentId: 'pay_1', signature: 'bad' });

        expect(await db.scalar(`SELECT count(*)::int FROM user_subscriptions`)).toBe(0);
    });

    it('activates a subscription on a valid signature', async () => {
        const { accessToken, dbUser } = await createAndSignIn();
        const plan = await createPlan({ durationDays: 30 });
        await createOrder({ userId: dbUser.id, planId: plan.id, razorpayOrderId: 'order_C' });

        const res = await request(app)
            .post('/api/v1/payments/verify')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                orderId: 'order_C',
                paymentId: 'pay_C',
                signature: checkoutSignature('order_C', 'pay_C'),
            });

        expect(res.status).toBe(200);
        expect(res.body.data.subscriptionActive).toBe(true);
        expect(res.body.data.inviteLink).toBe('https://t.me/+fake-invite');

        const sub = await db.one(`SELECT status, end_date FROM user_subscriptions WHERE user_id = $1`, [dbUser.id]);
        expect(sub.status).toBe('active');
        // Duration comes from the plan, computed by Postgres.
        const days = (new Date(sub.end_date) - Date.now()) / 86_400_000;
        expect(days).toBeGreaterThan(29);
        expect(days).toBeLessThan(31);
    });

    it('refuses to let one user confirm another user\'s order', async () => {
        const attacker = await createAndSignIn();
        const victim = await createUser();
        const plan = await createPlan();
        await createOrder({ userId: victim.id, planId: plan.id, razorpayOrderId: 'order_D' });

        const res = await request(app)
            .post('/api/v1/payments/verify')
            .set('Authorization', `Bearer ${attacker.accessToken}`)
            .send({
                orderId: 'order_D',
                paymentId: 'pay_D',
                signature: checkoutSignature('order_D', 'pay_D'),
            });

        expect(res.status).toBe(403);
        expect(await db.scalar(`SELECT count(*)::int FROM user_subscriptions`)).toBe(0);
    });

    it('404s for an unknown order', async () => {
        const { accessToken } = await createAndSignIn();

        const res = await request(app)
            .post('/api/v1/payments/verify')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                orderId: 'order_MISSING',
                paymentId: 'pay_X',
                signature: checkoutSignature('order_MISSING', 'pay_X'),
            });

        expect(res.status).toBe(404);
    });

    it('still reports success when Telegram invite generation fails', async () => {
        const telegramService = require('../../src/modules/telegram/telegram.service');
        telegramService.generateInviteLink.mockRejectedValueOnce(new Error('Telegram down'));

        const { accessToken, dbUser } = await createAndSignIn();
        const plan = await createPlan();
        await createOrder({ userId: dbUser.id, planId: plan.id, razorpayOrderId: 'order_E' });

        const res = await request(app)
            .post('/api/v1/payments/verify')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                orderId: 'order_E',
                paymentId: 'pay_E',
                signature: checkoutSignature('order_E', 'pay_E'),
            });

        // The customer paid; a messaging outage must not read as payment failure.
        expect(res.status).toBe(200);
        expect(res.body.data.warning).toBe('TELEGRAM_LINK_FAILED');
        expect(await db.scalar(`SELECT count(*)::int FROM user_subscriptions WHERE status='active'`)).toBe(1);
    });
});

describe('POST /api/v1/payments/webhook', () => {
    it('rejects a delivery with no signature', async () => {
        const res = await request(app).post('/api/v1/payments/webhook').send(capturedEvent('order_F'));
        expect(res.status).toBe(401);
    });

    it('rejects a forged signature', async () => {
        const body = capturedEvent('order_G');
        const res = await request(app)
            .post('/api/v1/payments/webhook')
            .set('X-Razorpay-Signature', 'forged')
            .send(body);

        expect(res.status).toBe(401);
    });

    it('records nothing when the signature is invalid', async () => {
        await request(app)
            .post('/api/v1/payments/webhook')
            .set('X-Razorpay-Signature', 'forged')
            .send(capturedEvent('order_H'));

        // Verification precedes logging, so unauthenticated callers cannot fill
        // the table with junk.
        expect(await db.scalar(`SELECT count(*)::int FROM webhook_logs`)).toBe(0);
    });

    it('activates a subscription on a valid delivery', async () => {
        const user = await createUser();
        const plan = await createPlan();
        await createOrder({ userId: user.id, planId: plan.id, razorpayOrderId: 'order_I' });

        const body = capturedEvent('order_I');
        const res = await request(app)
            .post('/api/v1/payments/webhook')
            .set('X-Razorpay-Signature', webhookSignature(body))
            .set('X-Razorpay-Event-Id', 'evt_I')
            .send(body);

        expect(res.status).toBe(200);
        const sub = await db.one(`SELECT status FROM user_subscriptions WHERE user_id = $1`, [user.id]);
        expect(sub.status).toBe('active');
    });

    it('ignores a redelivered event with the same event id', async () => {
        const user = await createUser();
        const plan = await createPlan();
        await createOrder({ userId: user.id, planId: plan.id, razorpayOrderId: 'order_J' });

        const body = capturedEvent('order_J');
        const send = () =>
            request(app)
                .post('/api/v1/payments/webhook')
                .set('X-Razorpay-Signature', webhookSignature(body))
                .set('X-Razorpay-Event-Id', 'evt_J')
                .send(body);

        await send();
        const second = await send();

        expect(second.body.duplicate).toBe(true);
        expect(await db.scalar(`SELECT count(*)::int FROM user_subscriptions`)).toBe(1);
    });

    it('tolerates an event for an order it does not know', async () => {
        const body = capturedEvent('order_UNKNOWN');
        const res = await request(app)
            .post('/api/v1/payments/webhook')
            .set('X-Razorpay-Signature', webhookSignature(body))
            .set('X-Razorpay-Event-Id', 'evt_K')
            .send(body);

        expect(res.status).toBe(200);
    });
});

describe('fulfilment idempotency', () => {
    it('produces exactly one subscription when checkout and webhook both arrive', async () => {
        const { accessToken, dbUser } = await createAndSignIn();
        const plan = await createPlan();
        await createOrder({ userId: dbUser.id, planId: plan.id, razorpayOrderId: 'order_L' });

        await request(app)
            .post('/api/v1/payments/verify')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                orderId: 'order_L',
                paymentId: 'pay_L',
                signature: checkoutSignature('order_L', 'pay_L'),
            });

        const body = capturedEvent('order_L', 'pay_L');
        await request(app)
            .post('/api/v1/payments/webhook')
            .set('X-Razorpay-Signature', webhookSignature(body))
            .set('X-Razorpay-Event-Id', 'evt_L')
            .send(body);

        // Previously each path activated independently, so this produced two.
        expect(await db.scalar(`SELECT count(*)::int FROM user_subscriptions`)).toBe(1);
    });

    it('activates once under CONCURRENT fulfilment', async () => {
        const user = await createUser();
        const plan = await createPlan();
        const order = await createOrder({ userId: user.id, planId: plan.id, razorpayOrderId: 'order_M' });

        // The conditional UPDATE is the guard; only one caller can claim.
        const results = await Promise.allSettled([
            fulfillOrder(order.id, { paymentId: 'pay_M', source: 'checkout' }),
            fulfillOrder(order.id, { paymentId: 'pay_M', source: 'webhook' }),
            fulfillOrder(order.id, { paymentId: 'pay_M', source: 'retry' }),
        ]);

        const activated = results.filter((r) => r.status === 'fulfilled' && r.value.activated);
        expect(activated).toHaveLength(1);
        expect(await db.scalar(`SELECT count(*)::int FROM user_subscriptions`)).toBe(1);
    });

    it('marks the order paid and the payment captured', async () => {
        const user = await createUser();
        const plan = await createPlan();
        const order = await createOrder({ userId: user.id, planId: plan.id, razorpayOrderId: 'order_N' });

        await fulfillOrder(order.id, { paymentId: 'pay_N', method: 'card', source: 'webhook' });

        expect(await db.scalar(`SELECT status FROM orders WHERE id = $1`, [order.id])).toBe('paid');
        const payment = await db.one(`SELECT status, method, razorpay_payment_id FROM payments WHERE order_id = $1`, [order.id]);
        expect(payment).toMatchObject({ status: 'captured', method: 'card', razorpay_payment_id: 'pay_N' });
    });
});

describe('POST /api/v1/payments/create-order', () => {
    it('requires authentication', async () => {
        expect((await request(app).post('/api/v1/payments/create-order').send({ planId: 'x' })).status).toBe(401);
    });

    it('validates that planId is a UUID', async () => {
        const { accessToken } = await createAndSignIn();
        const res = await request(app)
            .post('/api/v1/payments/create-order')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ planId: 'not-a-uuid' });

        expect(res.status).toBe(400);
    });

    it('refuses when the user already has an active subscription', async () => {
        const { accessToken, dbUser } = await createAndSignIn();
        const plan = await createPlan();
        await createSubscription({ userId: dbUser.id, planId: plan.id });

        const res = await request(app)
            .post('/api/v1/payments/create-order')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ planId: plan.id });

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('ACTIVE_SUBSCRIPTION_EXISTS');
    });

    it('404s for an unknown plan', async () => {
        const { accessToken } = await createAndSignIn();
        const res = await request(app)
            .post('/api/v1/payments/create-order')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ planId: '00000000-0000-0000-0000-000000000000' });

        expect(res.status).toBe(404);
    });

    it('refuses an inactive plan', async () => {
        const { accessToken } = await createAndSignIn();
        const plan = await createPlan({ isActive: false });

        const res = await request(app)
            .post('/api/v1/payments/create-order')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ planId: plan.id });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('PLAN_INACTIVE');
    });
});
