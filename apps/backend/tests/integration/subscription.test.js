const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/config/db');
const subscriptionService = require('../../src/modules/subscription/subscription.service');
const { createUser, createPlan, createSubscription, createOrder } = require('../helpers/factories');
const { createAndSignIn } = require('../helpers/auth');

describe('GET /api/v1/subscriptions/plans', () => {
    it('is public — the pricing page renders before sign-in', async () => {
        await createPlan({ name: 'Monthly', price: 3000 });
        const res = await request(app).get('/api/v1/subscriptions/plans');

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
    });

    it('hides inactive plans', async () => {
        await createPlan({ name: 'Live', isActive: true });
        await createPlan({ name: 'Retired', isActive: false });

        const res = await request(app).get('/api/v1/subscriptions/plans');

        expect(res.body.data.map((p) => p.name)).toEqual(['Live']);
    });
});

describe('GET /api/v1/subscriptions', () => {
    it('requires authentication', async () => {
        expect((await request(app).get('/api/v1/subscriptions')).status).toBe(401);
    });

    it('reports no subscription for a new account', async () => {
        const { accessToken } = await createAndSignIn();
        const res = await request(app)
            .get('/api/v1/subscriptions')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data).toBeUndefined();
    });

    it('returns the active subscription with its plan embedded', async () => {
        const { accessToken, dbUser } = await createAndSignIn();
        const plan = await createPlan({ name: 'Quarterly', price: 8000 });
        await createSubscription({ userId: dbUser.id, planId: plan.id });

        const res = await request(app)
            .get('/api/v1/subscriptions')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.body.data.status).toBe('active');
        expect(res.body.data.plan).toMatchObject({ name: 'Quarterly', price: 8000 });
    });

    it('does not return a lapsed subscription', async () => {
        const { accessToken, dbUser } = await createAndSignIn();
        const plan = await createPlan();
        await createSubscription({ userId: dbUser.id, planId: plan.id, daysRemaining: -1 });

        const res = await request(app)
            .get('/api/v1/subscriptions')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.body.data).toBeUndefined();
    });

    it('never exposes another user\'s subscription', async () => {
        const { accessToken } = await createAndSignIn();
        const other = await createUser();
        const plan = await createPlan();
        await createSubscription({ userId: other.id, planId: plan.id });

        const res = await request(app)
            .get('/api/v1/subscriptions')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.body.data).toBeUndefined();
    });
});

describe('subscription lifecycle', () => {
    it('computes end_date from the plan duration', async () => {
        const user = await createUser();
        const plan = await createPlan({ durationDays: 90 });

        const sub = await subscriptionService.createSubscription(user.id, plan.id);

        const days = (new Date(sub.end_date) - new Date(sub.start_date)) / 86_400_000;
        expect(Math.round(days)).toBe(90);
    });

    it('expires the previous subscription when a new one starts', async () => {
        const user = await createUser();
        const first = await createPlan({ name: 'First', durationDays: 30 });
        const second = await createPlan({ name: 'Second', durationDays: 365 });

        await subscriptionService.createSubscription(user.id, first.id);
        await subscriptionService.createSubscription(user.id, second.id);

        const active = await db.many(
            `SELECT plan_id FROM user_subscriptions WHERE user_id = $1 AND status = 'active'`,
            [user.id]
        );
        expect(active).toHaveLength(1);
        expect(active[0].plan_id).toBe(second.id);
    });

    it('rejects an unknown plan', async () => {
        const user = await createUser();

        await expect(
            subscriptionService.createSubscription(user.id, '00000000-0000-0000-0000-000000000000')
        ).rejects.toMatchObject({ code: 'PLAN_NOT_FOUND' });
    });

    it('rolls back cleanly when creation fails, leaving the old subscription intact', async () => {
        const user = await createUser();
        const plan = await createPlan();
        await subscriptionService.createSubscription(user.id, plan.id);

        // Expiring the old row and inserting the new one share a transaction,
        // so a failure must not leave a paying user with nothing.
        await expect(
            subscriptionService.createSubscription(user.id, '00000000-0000-0000-0000-000000000000')
        ).rejects.toThrow();

        expect(await db.scalar(
            `SELECT count(*)::int FROM user_subscriptions WHERE user_id = $1 AND status = 'active'`,
            [user.id]
        )).toBe(1);
    });

    it('cancels only the caller\'s own subscription', async () => {
        const { accessToken } = await createAndSignIn();
        const other = await createUser();
        const plan = await createPlan();
        const foreign = await createSubscription({ userId: other.id, planId: plan.id });

        const res = await request(app)
            .post(`/api/v1/subscriptions/${foreign.id}/cancel`)
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.status).toBe(404);
        expect(await db.scalar(`SELECT status FROM user_subscriptions WHERE id = $1`, [foreign.id])).toBe('active');
    });

    it('cancels the caller\'s subscription', async () => {
        const { accessToken, dbUser } = await createAndSignIn();
        const plan = await createPlan();
        const sub = await createSubscription({ userId: dbUser.id, planId: plan.id });

        const res = await request(app)
            .post(`/api/v1/subscriptions/${sub.id}/cancel`)
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.status).toBe(200);
        expect(await db.scalar(`SELECT status FROM user_subscriptions WHERE id = $1`, [sub.id])).toBe('cancelled');
    });

    it('returns history including expired entries', async () => {
        const { accessToken, dbUser } = await createAndSignIn();
        const plan = await createPlan();
        await createSubscription({ userId: dbUser.id, planId: plan.id, status: 'expired', daysRemaining: -30 });
        await createSubscription({ userId: dbUser.id, planId: plan.id });

        const res = await request(app)
            .get('/api/v1/subscriptions/history')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.body.data).toHaveLength(2);
    });
});

describe('orders', () => {
    it('lists only the caller\'s orders, with line items', async () => {
        const { accessToken, dbUser } = await createAndSignIn();
        const other = await createUser();
        const plan = await createPlan({ name: 'Monthly' });
        await createOrder({ userId: dbUser.id, planId: plan.id });
        await createOrder({ userId: other.id, planId: plan.id });

        const res = await request(app)
            .get('/api/v1/orders')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].items).toHaveLength(1);
        expect(res.body[0].items[0].plan_name).toBe('Monthly');
    });

    it('404s when fetching another user\'s order by id', async () => {
        const { accessToken } = await createAndSignIn();
        const other = await createUser();
        const plan = await createPlan();
        const foreign = await createOrder({ userId: other.id, planId: plan.id });

        const res = await request(app)
            .get(`/api/v1/orders/${foreign.id}`)
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.status).toBe(404);
    });
});

describe('addresses', () => {
    const sample = { fullName: 'Ada Lovelace', phone: '9999999999', street: '1 Analytical Way', city: 'Chennai', state: 'TN', pincode: '600001', country: 'India' };

    it('requires authentication', async () => {
        expect((await request(app).get('/api/v1/address')).status).toBe(401);
    });

    it('creates and lists an address', async () => {
        const { accessToken } = await createAndSignIn();

        expect((await request(app)
            .post('/api/v1/address/add')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(sample)).status).toBe(201);

        const list = await request(app)
            .get('/api/v1/address')
            .set('Authorization', `Bearer ${accessToken}`);
        expect(list.body).toHaveLength(1);
        expect(list.body[0].city).toBe('Chennai');
    });

    it('keeps at most one default address per user', async () => {
        const { accessToken, dbUser } = await createAndSignIn();

        await request(app).post('/api/v1/address/add')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ ...sample, isDefault: true });
        await request(app).post('/api/v1/address/add')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ ...sample, city: 'Mumbai', isDefault: true });

        // Enforced by a partial unique index; the service clears the old
        // default inside the same transaction.
        expect(await db.scalar(
            `SELECT count(*)::int FROM addresses WHERE user_id = $1 AND is_default`,
            [dbUser.id]
        )).toBe(1);
    });

    it('cannot update another user\'s address', async () => {
        const { accessToken } = await createAndSignIn();
        const other = await createUser();
        const foreign = await db.one(
            `INSERT INTO addresses (user_id, city) VALUES ($1, 'Delhi') RETURNING id`,
            [other.id]
        );

        await request(app)
            .put(`/api/v1/address/${foreign.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ city: 'Hacked' });

        expect(await db.scalar(`SELECT city FROM addresses WHERE id = $1`, [foreign.id])).toBe('Delhi');
    });

    it('cannot delete another user\'s address', async () => {
        const { accessToken } = await createAndSignIn();
        const other = await createUser();
        const foreign = await db.one(
            `INSERT INTO addresses (user_id, city) VALUES ($1, 'Pune') RETURNING id`,
            [other.id]
        );

        await request(app)
            .delete(`/api/v1/address/${foreign.id}`)
            .set('Authorization', `Bearer ${accessToken}`);

        expect(await db.scalar(`SELECT count(*)::int FROM addresses WHERE id = $1`, [foreign.id])).toBe(1);
    });
});

describe('user profile', () => {
    it('returns the caller profile without the password hash', async () => {
        const { accessToken, dbUser } = await createAndSignIn();

        const res = await request(app)
            .get('/api/v1/users/profile')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.email).toBe(dbUser.email);
        expect(JSON.stringify(res.body)).not.toContain('password_hash');
    });
});
