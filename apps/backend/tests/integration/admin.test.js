const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/config/db');
const {
    createUser, createPlan, createSubscription, uniqueEmail,
} = require('../helpers/factories');
const { createAndSignIn, createAdminAndSignIn } = require('../helpers/auth');

/**
 * Admin API: access control, injection resistance, and data-exposure checks.
 */

const ADMIN_ROUTES = [
    ['get', '/api/v1/admin/stats'],
    ['get', '/api/v1/admin/users'],
    ['get', '/api/v1/admin/audit'],
    ['get', '/api/v1/admin/plans'],
    ['get', '/api/v1/admin/subscriptions'],
    ['get', '/api/v1/admin/payments'],
    ['get', '/api/v1/admin/webhooks'],
    ['get', '/api/v1/admin/tables'],
];

describe('admin access control', () => {
    it.each(ADMIN_ROUTES)('%s %s rejects anonymous callers with 401', async (method, path) => {
        expect((await request(app)[method](path)).status).toBe(401);
    });

    it.each(ADMIN_ROUTES)('%s %s rejects a normal user with 403', async (method, path) => {
        const { accessToken } = await createAndSignIn();
        const res = await request(app)[method](path).set('Authorization', `Bearer ${accessToken}`);

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('rejects a user whose token CLAIMS admin but whose row does not', async () => {
        const user = await createUser({ role: 'user' });
        // Role is re-read from the database on every admin request precisely so
        // a stale or crafted claim cannot grant access.
        const tokenService = require('../../src/modules/auth/token.service');
        const lying = tokenService.signAccessToken({ ...user, role: 'admin' });

        const res = await request(app)
            .get('/api/v1/admin/stats')
            .set('Authorization', `Bearer ${lying}`);

        expect(res.status).toBe(403);
    });

    it('revokes access the moment an admin is demoted, without waiting for token expiry', async () => {
        const { accessToken, dbUser } = await createAdminAndSignIn();
        expect((await request(app).get('/api/v1/admin/stats').set('Authorization', `Bearer ${accessToken}`)).status).toBe(200);

        await db.query(`UPDATE users SET role = 'user' WHERE id = $1`, [dbUser.id]);

        const after = await request(app)
            .get('/api/v1/admin/stats')
            .set('Authorization', `Bearer ${accessToken}`);
        expect(after.status).toBe(403);
    });

    it('denies a deactivated admin', async () => {
        const { accessToken, dbUser } = await createAdminAndSignIn();
        await db.query(`UPDATE users SET is_active = FALSE WHERE id = $1`, [dbUser.id]);

        expect((await request(app).get('/api/v1/admin/stats').set('Authorization', `Bearer ${accessToken}`)).status).toBe(403);
    });
});

describe('GET /api/v1/admin/stats', () => {
    it('aggregates users, subscriptions and revenue', async () => {
        const { accessToken } = await createAdminAndSignIn();
        const plan = await createPlan();
        const user = await createUser();
        await createSubscription({ userId: user.id, planId: plan.id });
        await db.query(
            `INSERT INTO payments (user_id, amount, status) VALUES ($1, 3000, 'captured'), ($1, 500, 'pending')`,
            [user.id]
        );

        const res = await request(app).get('/api/v1/admin/stats').set('Authorization', `Bearer ${accessToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.totalUsers).toBe(2); // admin + user
        expect(res.body.data.activeSubscriptions).toBe(1);
        // Only captured payments count toward revenue.
        expect(res.body.data.totalRevenue).toBe(3000);
    });
});

describe('GET /api/v1/admin/users', () => {
    it('paginates with correct totals', async () => {
        const { accessToken } = await createAdminAndSignIn();
        for (let i = 0; i < 5; i += 1) await createUser();

        const page1 = await request(app)
            .get('/api/v1/admin/users?page=1&limit=2')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(page1.body.data.items).toHaveLength(2);
        expect(page1.body.data.total).toBe(6); // 5 + the admin
        expect(page1.body.data.totalPages).toBe(3);
    });

    it('returns a full page, not one row short', async () => {
        // Supabase .range(from, to) is inclusive on both ends; LIMIT/OFFSET is
        // not. A naive conversion silently drops a row from every page.
        const { accessToken } = await createAdminAndSignIn();
        for (let i = 0; i < 10; i += 1) await createUser();

        const res = await request(app)
            .get('/api/v1/admin/users?page=1&limit=10')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.body.data.items).toHaveLength(10);
    });

    it('does not repeat or skip rows across pages', async () => {
        const { accessToken } = await createAdminAndSignIn();
        for (let i = 0; i < 6; i += 1) await createUser();

        const get = async (page) =>
            (await request(app)
                .get(`/api/v1/admin/users?page=${page}&limit=3`)
                .set('Authorization', `Bearer ${accessToken}`)).body.data.items.map((u) => u.id);

        const ids = [...(await get(1)), ...(await get(2)), ...(await get(3))];

        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toHaveLength(7); // 6 + admin
    });

    it('filters by search term', async () => {
        const { accessToken } = await createAdminAndSignIn();
        await createUser({ email: 'findme@example.test', fullName: 'Findable Person' });
        await createUser({ email: 'other@example.test' });

        const res = await request(app)
            .get('/api/v1/admin/users?search=findme')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.body.data.items).toHaveLength(1);
        expect(res.body.data.items[0].email).toBe('findme@example.test');
    });

    it('treats a SQL wildcard payload in search as literal text', async () => {
        const { accessToken } = await createAdminAndSignIn();
        await createUser();

        const res = await request(app)
            .get(`/api/v1/admin/users?search=${encodeURIComponent("%' OR '1'='1")}`)
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.total).toBe(0);
    });

    it('never includes password hashes', async () => {
        const { accessToken } = await createAdminAndSignIn();
        await createUser();

        const res = await request(app).get('/api/v1/admin/users').set('Authorization', `Bearer ${accessToken}`);

        expect(JSON.stringify(res.body)).not.toContain('password_hash');
        expect(JSON.stringify(res.body)).not.toContain('$2b$');
    });
});

describe('admin user management', () => {
    it('creates a user with a hashed password', async () => {
        const { accessToken } = await createAdminAndSignIn();
        const email = uniqueEmail();

        const res = await request(app)
            .post('/api/v1/admin/users')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ email, password: 'AdminMadeThis1', full_name: 'Made By Admin', role: 'user' });

        expect(res.status).toBe(201);

        // The created account must actually be able to sign in.
        const login = await request(app)
            .post('/api/v1/auth/login')
            .send({ email, password: 'AdminMadeThis1' });
        expect(login.status).toBe(200);
    });

    it('writes an audit record', async () => {
        const { accessToken } = await createAdminAndSignIn();
        const email = uniqueEmail();

        const created = await request(app)
            .post('/api/v1/admin/users')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ email, password: 'AdminMadeThis1', full_name: 'Audited User', role: 'user' });
        expect(created.status).toBe(201);

        const log = await db.one(`SELECT action, details FROM audit_logs ORDER BY created_at DESC LIMIT 1`);
        expect(log.action).toBe('user.create');
        expect(log.details).toMatchObject({ email, role: 'user' });
    });

    it('applies the same password policy as self-service registration', async () => {
        const { accessToken } = await createAdminAndSignIn();

        // Admin create-user previously accepted 6 characters while registration
        // demanded 10, letting an admin provision a sub-policy account.
        const res = await request(app)
            .post('/api/v1/admin/users')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ email: uniqueEmail(), password: 'six123', full_name: 'Weak Password', role: 'user' });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('refuses a duplicate email', async () => {
        const { accessToken } = await createAdminAndSignIn();
        const existing = await createUser();

        const res = await request(app)
            .post('/api/v1/admin/users')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ email: existing.email, password: 'AdminMadeThis1', full_name: 'Dup', role: 'user' });

        expect(res.status).toBe(409);
    });

    it('stops an admin demoting themselves', async () => {
        const { accessToken, dbUser } = await createAdminAndSignIn();

        const res = await request(app)
            .put(`/api/v1/admin/users/${dbUser.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ role: 'user' });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('SELF_DEMOTION');
    });

    it('stops an admin deleting themselves', async () => {
        const { accessToken, dbUser } = await createAdminAndSignIn();

        const res = await request(app)
            .delete(`/api/v1/admin/users/${dbUser.id}`)
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('SELF_DELETE');
    });

    it('revokes sessions when an admin resets a password', async () => {
        const { accessToken } = await createAdminAndSignIn();
        const victim = await createAndSignIn();

        await request(app)
            .put(`/api/v1/admin/users/${victim.dbUser.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ password: 'AdminResetThis9' });

        const refresh = await request(app)
            .post('/api/v1/auth/refresh')
            .set('Cookie', victim.refreshCookie);
        expect(refresh.status).toBe(401);
    });

    it('cascades dependent rows when deleting a user', async () => {
        const { accessToken } = await createAdminAndSignIn();
        const plan = await createPlan();
        const user = await createUser();
        await createSubscription({ userId: user.id, planId: plan.id });
        await db.query(`INSERT INTO telegram_access (user_id, telegram_user_id) VALUES ($1, 42)`, [user.id]);

        const res = await request(app)
            .delete(`/api/v1/admin/users/${user.id}`)
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.status).toBe(200);
        // Foreign keys declare the cascade; no manual per-table loop needed.
        expect(await db.scalar(`SELECT count(*)::int FROM user_subscriptions WHERE user_id = $1`, [user.id])).toBe(0);
        expect(await db.scalar(`SELECT count(*)::int FROM telegram_access WHERE user_id = $1`, [user.id])).toBe(0);
    });

    it('404s for an unknown user', async () => {
        const { accessToken } = await createAdminAndSignIn();
        const res = await request(app)
            .delete('/api/v1/admin/users/00000000-0000-0000-0000-000000000000')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.status).toBe(404);
    });
});

describe('admin subscription grants', () => {
    it('grants by plan name and expires any previous active subscription', async () => {
        const { accessToken } = await createAdminAndSignIn();
        const plan = await createPlan({ name: 'Monthly', durationDays: 30 });
        const other = await createPlan({ name: 'Yearly', durationDays: 365 });
        const user = await createUser();
        await createSubscription({ userId: user.id, planId: other.id });

        const res = await request(app)
            .post('/api/v1/admin/subscriptions/grant')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ email: user.email, planId: 'Monthly', durationInDays: 30 });

        expect(res.status).toBe(201);
        // The partial unique index permits exactly one active row per user.
        expect(await db.scalar(
            `SELECT count(*)::int FROM user_subscriptions WHERE user_id = $1 AND status = 'active'`,
            [user.id]
        )).toBe(1);
        expect(plan.id).toBeDefined();
    });

    it('404s for an unknown plan', async () => {
        const { accessToken } = await createAdminAndSignIn();
        const user = await createUser();

        const res = await request(app)
            .post('/api/v1/admin/subscriptions/grant')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ email: user.email, planId: 'NoSuchPlan', durationInDays: 30 });

        expect(res.status).toBe(404);
    });

    it('revokes a subscription and expires it immediately', async () => {
        const { accessToken } = await createAdminAndSignIn();
        const plan = await createPlan();
        const user = await createUser();
        const sub = await createSubscription({ userId: user.id, planId: plan.id });

        const res = await request(app)
            .post('/api/v1/admin/subscriptions/revoke')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ subscriptionId: sub.id });

        expect(res.status).toBe(200);
        const row = await db.one(`SELECT status, end_date FROM user_subscriptions WHERE id = $1`, [sub.id]);
        expect(row.status).toBe('cancelled');
        expect(new Date(row.end_date).getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    });
});

describe('admin table browser', () => {
    it('lists only whitelisted tables', async () => {
        const { accessToken } = await createAdminAndSignIn();
        const res = await request(app).get('/api/v1/admin/tables').set('Authorization', `Bearer ${accessToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.tables).toContain('users');
        expect(res.body.data.tables).not.toContain('pgmigrations');
    });

    it('reads a whitelisted table', async () => {
        const { accessToken } = await createAdminAndSignIn();
        const res = await request(app).get('/api/v1/admin/tables/users').set('Authorization', `Bearer ${accessToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.data.length).toBeGreaterThan(0);
    });

    it('strips password hashes from the users table view', async () => {
        const { accessToken } = await createAdminAndSignIn();
        const res = await request(app).get('/api/v1/admin/tables/users').set('Authorization', `Bearer ${accessToken}`);

        expect(JSON.stringify(res.body)).not.toContain('password_hash');
        expect(JSON.stringify(res.body)).not.toContain('$2b$');
    });

    it.each([
        ['a system catalog', 'pg_shadow'],
        ['the migrations table', 'pgmigrations'],
        ['a SQL injection payload', 'users; DROP TABLE users--'],
        ['a quoted injection payload', 'users" UNION SELECT * FROM users--'],
    ])('refuses %s', async (_label, tableName) => {
        const { accessToken } = await createAdminAndSignIn();
        const res = await request(app)
            .get(`/api/v1/admin/tables/${encodeURIComponent(tableName)}`)
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('TABLE_NOT_ALLOWED');
    });

    it('leaves the users table intact after an injection attempt', async () => {
        const { accessToken } = await createAdminAndSignIn();
        await request(app)
            .get(`/api/v1/admin/tables/${encodeURIComponent('users; DROP TABLE users--')}`)
            .set('Authorization', `Bearer ${accessToken}`);

        expect(await db.scalar(`SELECT count(*)::int FROM users`)).toBeGreaterThan(0);
    });
});

describe('admin CSV export', () => {
    it('exports users as CSV', async () => {
        const { accessToken } = await createAdminAndSignIn();
        await createUser({ email: 'csv@example.test' });

        const res = await request(app)
            .get('/api/v1/admin/export/users')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/text\/csv/);
        expect(res.text).toContain('csv@example.test');
    });

    it('neutralises spreadsheet formula injection', async () => {
        const { accessToken } = await createAdminAndSignIn();
        await createUser({ fullName: '=cmd|/c calc!A1' });

        const res = await request(app)
            .get('/api/v1/admin/export/users')
            .set('Authorization', `Bearer ${accessToken}`);

        // Prefixed with an apostrophe so Excel/Sheets treat it as text.
        expect(res.text).toContain(`"'=cmd`);
    });

    it('rejects an unknown export type', async () => {
        const { accessToken } = await createAdminAndSignIn();
        const res = await request(app)
            .get('/api/v1/admin/export/secrets')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.status).toBe(400);
    });
});

describe('admin settings', () => {
    it('requires authentication', async () => {
        expect((await request(app).get('/api/v1/settings')).status).toBe(401);
    });

    it('requires the admin role', async () => {
        const { accessToken } = await createAndSignIn();
        expect(
            (await request(app).get('/api/v1/settings').set('Authorization', `Bearer ${accessToken}`)).status
        ).toBe(403);
    });

    it('writes whitelisted keys and ignores everything else', async () => {
        const { accessToken } = await createAdminAndSignIn();

        const res = await request(app)
            .post('/api/v1/settings')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ SUPPORT_EMAIL: 'help@example.test', NOT_A_REAL_SETTING: 'x' });

        expect(res.status).toBe(200);
        expect(res.body.data.updated).toContain('SUPPORT_EMAIL');
        expect(res.body.data.rejected).toContain('NOT_A_REAL_SETTING');
    });

    it('rejects a body that is not a flat string map', async () => {
        const { accessToken } = await createAdminAndSignIn();

        const res = await request(app)
            .post('/api/v1/settings')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ SUPPORT_EMAIL: { nested: 'object' } });

        expect(res.status).toBe(400);
    });

    it('masks the bot token in the response', async () => {
        const { accessToken } = await createAdminAndSignIn();
        await request(app)
            .post('/api/v1/settings')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ TELEGRAM_BOT_TOKEN: '123456:REALSECRETVALUE' });

        const res = await request(app).get('/api/v1/settings').set('Authorization', `Bearer ${accessToken}`);

        expect(JSON.stringify(res.body)).not.toContain('REALSECRETVALUE');
    });
});
