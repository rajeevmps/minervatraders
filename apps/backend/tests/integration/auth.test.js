const request = require('supertest');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = require('../../src/app');
const db = require('../../src/config/db');
const { createUser, uniqueEmail, DEFAULT_PASSWORD } = require('../helpers/factories');
const { signIn, refreshCookie, createAndSignIn } = require('../helpers/auth');

describe('POST /api/v1/auth/register', () => {
    it('creates an account and issues a session', async () => {
        const email = uniqueEmail();
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ email, password: DEFAULT_PASSWORD, fullName: 'New User' });

        expect(res.status).toBe(201);
        expect(res.body.data.accessToken).toEqual(expect.any(String));
        expect(res.body.data.user.email).toBe(email);
        expect(res.body.data.user.role).toBe('user');
    });

    it('sets the refresh token as an httpOnly cookie', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ email: uniqueEmail(), password: DEFAULT_PASSWORD });

        const cookie = (res.headers['set-cookie'] || []).find((c) => c.startsWith('refresh_token='));
        expect(cookie).toBeDefined();
        expect(cookie).toMatch(/HttpOnly/i);
        expect(cookie).toMatch(/SameSite=Lax/i);
    });

    it('never returns the password hash', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ email: uniqueEmail(), password: DEFAULT_PASSWORD });

        expect(JSON.stringify(res.body)).not.toContain('password_hash');
        expect(JSON.stringify(res.body)).not.toContain(DEFAULT_PASSWORD);
    });

    it('stores a bcrypt hash rather than the plaintext password', async () => {
        const email = uniqueEmail();
        await request(app).post('/api/v1/auth/register').send({ email, password: DEFAULT_PASSWORD });

        const row = await db.one(`SELECT password_hash FROM users WHERE email = $1`, [email]);
        expect(row.password_hash).toMatch(/^\$2[aby]\$/);
        expect(row.password_hash).not.toBe(DEFAULT_PASSWORD);
    });

    it('rejects a password below the length policy', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ email: uniqueEmail(), password: 'short' });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects a password longer than bcrypt actually hashes (72 bytes)', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ email: uniqueEmail(), password: 'a'.repeat(100) });

        // Silently truncating would mean only the first 72 bytes are ever checked.
        expect(res.status).toBe(400);
    });

    it('rejects a malformed email', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ email: 'not-an-email', password: DEFAULT_PASSWORD });

        expect(res.status).toBe(400);
    });

    it('refuses a duplicate email', async () => {
        const user = await createUser();
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ email: user.email, password: DEFAULT_PASSWORD });

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('EMAIL_TAKEN');
    });

    it('treats email as case-insensitive when detecting duplicates', async () => {
        const user = await createUser({ email: 'Case.Test@example.test' });
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ email: 'CASE.TEST@EXAMPLE.TEST', password: DEFAULT_PASSWORD });

        expect(res.status).toBe(409);
        expect(user.email).toBeDefined();
    });

    it('never lets a client choose its own role', async () => {
        const email = uniqueEmail();
        await request(app)
            .post('/api/v1/auth/register')
            .send({ email, password: DEFAULT_PASSWORD, role: 'admin' });

        const row = await db.one(`SELECT role FROM users WHERE email = $1`, [email]);
        expect(row.role).toBe('user');
    });
});

describe('POST /api/v1/auth/login', () => {
    it('signs in with correct credentials', async () => {
        const user = await createUser();
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: user.email, password: user.password });

        expect(res.status).toBe(200);
        expect(res.body.data.accessToken).toEqual(expect.any(String));
    });

    it('records last_login_at', async () => {
        const user = await createUser();
        await signIn({ email: user.email, password: user.password });

        const row = await db.one(`SELECT last_login_at FROM users WHERE id = $1`, [user.id]);
        expect(row.last_login_at).not.toBeNull();
    });

    it('rejects a wrong password', async () => {
        const user = await createUser();
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: user.email, password: 'WrongPassword123' });

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('gives an identical response for unknown and wrong-password, avoiding user enumeration', async () => {
        const user = await createUser();

        const unknown = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: uniqueEmail(), password: DEFAULT_PASSWORD });
        const wrongPassword = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: user.email, password: 'WrongPassword123' });

        expect(unknown.status).toBe(wrongPassword.status);
        expect(unknown.body.message).toBe(wrongPassword.body.message);
        expect(unknown.body.error.code).toBe(wrongPassword.body.error.code);
    });

    it('refuses a deactivated account', async () => {
        const user = await createUser({ isActive: false });
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: user.email, password: user.password });

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
    });

    it('refuses a Telegram-only account that has no password', async () => {
        const email = uniqueEmail();
        await db.query(
            `INSERT INTO users (email, telegram_user_id) VALUES ($1, 987654321)`,
            [email]
        );

        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email, password: DEFAULT_PASSWORD });

        expect(res.status).toBe(401);
    });
});

describe('GET /api/v1/auth/me', () => {
    it('returns the caller profile', async () => {
        const { accessToken, dbUser } = await createAndSignIn();
        const res = await request(app)
            .get('/api/v1/auth/me')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.email).toBe(dbUser.email);
    });

    it.each([
        ['no header', null],
        ['malformed header', 'Basic abc'],
        ['garbage token', 'Bearer not.a.jwt'],
        ['empty bearer', 'Bearer '],
    ])('rejects a request with %s', async (_label, header) => {
        const req = request(app).get('/api/v1/auth/me');
        if (header) req.set('Authorization', header);

        expect((await req).status).toBe(401);
    });

    it('rejects a token forged with an attacker-chosen secret', async () => {
        const user = await createUser();
        const forged = jwt.sign({ sub: user.id, role: 'admin' }, 'attacker-secret', {
            issuer: 'minerva-api',
            expiresIn: '1h',
        });

        // The previous middleware swallowed signature failures and fell back to
        // a remote lookup, so this had a path to succeeding.
        const res = await request(app)
            .get('/api/v1/auth/me')
            .set('Authorization', `Bearer ${forged}`);

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('reports TOKEN_EXPIRED distinctly so clients know to refresh', async () => {
        const user = await createUser();
        const expired = jwt.sign({ sub: user.id }, process.env.JWT_ACCESS_SECRET, {
            issuer: 'minerva-api',
            expiresIn: '-1s',
        });

        const res = await request(app)
            .get('/api/v1/auth/me')
            .set('Authorization', `Bearer ${expired}`);

        expect(res.body.error.code).toBe('TOKEN_EXPIRED');
    });
});

describe('POST /api/v1/auth/refresh', () => {
    it('issues a new access token and rotates the cookie', async () => {
        const { refreshCookie: cookie } = await createAndSignIn();

        const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.body.data.accessToken).toEqual(expect.any(String));
        expect(refreshCookie(res)).not.toBe(cookie);
    });

    it('rejects a request with no cookie', async () => {
        expect((await request(app).post('/api/v1/auth/refresh')).status).toBe(401);
    });

    it('burns the entire family when a rotated token is replayed', async () => {
        const { refreshCookie: original } = await createAndSignIn();

        const rotated = await request(app).post('/api/v1/auth/refresh').set('Cookie', original);
        const newCookie = refreshCookie(rotated);

        // Replay of the consumed token: the classic stolen-token signal.
        const replay = await request(app).post('/api/v1/auth/refresh').set('Cookie', original);
        expect(replay.status).toBe(401);

        // The legitimate client is logged out too — correct, and the behaviour
        // that a rollback bug previously prevented.
        const afterBurn = await request(app).post('/api/v1/auth/refresh').set('Cookie', newCookie);
        expect(afterBurn.status).toBe(401);
    });

    it('clears the cookie when refresh fails', async () => {
        const res = await request(app)
            .post('/api/v1/auth/refresh')
            .set('Cookie', 'refresh_token=bogus');

        expect(res.status).toBe(401);
        expect((res.headers['set-cookie'] || []).join(';')).toMatch(/refresh_token=;|refresh_token=,/);
    });
});

describe('POST /api/v1/auth/logout', () => {
    it('invalidates the refresh token', async () => {
        const { refreshCookie: cookie } = await createAndSignIn();

        expect((await request(app).post('/api/v1/auth/logout').set('Cookie', cookie)).status).toBe(200);
        expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie)).status).toBe(401);
    });

    it('succeeds even with no session, so clients can always sign out', async () => {
        expect((await request(app).post('/api/v1/auth/logout')).status).toBe(200);
    });
});

describe('POST /api/v1/auth/change-password', () => {
    it('changes the password and revokes every existing session', async () => {
        const { accessToken, refreshCookie: cookie, dbUser } = await createAndSignIn();

        const res = await request(app)
            .post('/api/v1/auth/change-password')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ currentPassword: dbUser.password, newPassword: 'BrandNewPassword9' });

        expect(res.status).toBe(200);
        expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie)).status).toBe(401);

        const relogin = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: dbUser.email, password: 'BrandNewPassword9' });
        expect(relogin.status).toBe(200);
    });

    it('refuses when the current password is wrong', async () => {
        const { accessToken } = await createAndSignIn();

        const res = await request(app)
            .post('/api/v1/auth/change-password')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ currentPassword: 'NotMyPassword1', newPassword: 'BrandNewPassword9' });

        expect(res.status).toBe(403);
    });

    it('enforces the password policy on the new password', async () => {
        const { accessToken, dbUser } = await createAndSignIn();

        const res = await request(app)
            .post('/api/v1/auth/change-password')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ currentPassword: dbUser.password, newPassword: 'weak' });

        expect(res.status).toBe(400);
    });
});

describe('POST /api/v1/auth/telegram', () => {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

    const signedPayload = (overrides = {}) => {
        const fields = {
            id: 555000111,
            first_name: 'Grace',
            username: 'grace',
            auth_date: Math.floor(Date.now() / 1000),
            ...overrides,
        };
        const dataCheckString = Object.keys(fields)
            .sort()
            .map((k) => `${k}=${fields[k]}`)
            .join('\n');
        const secretKey = crypto.createHash('sha256').update(BOT_TOKEN).digest();
        const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
        return { ...fields, hash };
    };

    it('creates an account on first Telegram sign-in', async () => {
        const res = await request(app).post('/api/v1/auth/telegram').send(signedPayload());

        expect(res.status).toBe(200);
        expect(res.body.data.user.telegramUserId).toBe('555000111');

        const row = await db.one(`SELECT telegram_user_id, password_hash FROM users WHERE telegram_user_id = 555000111`);
        expect(row.password_hash).toBeNull();
    });

    it('signs in to the same account on the second attempt', async () => {
        await request(app).post('/api/v1/auth/telegram').send(signedPayload());
        const second = await request(app).post('/api/v1/auth/telegram').send(signedPayload());

        expect(second.status).toBe(200);
        expect(await db.scalar(`SELECT count(*)::int FROM users`)).toBe(1);
    });

    it('rejects a payload with a bogus hash', async () => {
        // Shape is valid, so this gets past schema validation and is caught by
        // the HMAC check — 401, not 400.
        const res = await request(app)
            .post('/api/v1/auth/telegram')
            .send({ id: 555000111, auth_date: Math.floor(Date.now() / 1000), hash: 'deadbeef' });

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('TELEGRAM_BAD_SIGNATURE');
    });

    it('rejects a payload with no hash at all', async () => {
        // Missing required field, so schema validation rejects it first.
        const res = await request(app)
            .post('/api/v1/auth/telegram')
            .send({ id: 555000111, auth_date: Math.floor(Date.now() / 1000) });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects a tampered payload', async () => {
        const payload = signedPayload();
        payload.id = 999999999;

        const res = await request(app).post('/api/v1/auth/telegram').send(payload);

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('TELEGRAM_BAD_SIGNATURE');
    });

    it('refuses to link a Telegram account already owned by someone else', async () => {
        await createUser({ telegramUserId: 555000111 });
        const { accessToken } = await createAndSignIn();

        const res = await request(app)
            .post('/api/v1/auth/link-telegram')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(signedPayload());

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('TELEGRAM_ALREADY_LINKED');
    });

    it('links Telegram to the signed-in account', async () => {
        const { accessToken, dbUser } = await createAndSignIn();

        const res = await request(app)
            .post('/api/v1/auth/link-telegram')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(signedPayload());

        expect(res.status).toBe(200);
        const row = await db.one(`SELECT telegram_user_id FROM users WHERE id = $1`, [dbUser.id]);
        expect(String(row.telegram_user_id)).toBe('555000111');
    });
});

describe('removed endpoints', () => {
    it('POST /auth/sync no longer exists', async () => {
        // It was unauthenticated and wrote `role` straight from the body.
        const res = await request(app)
            .post('/api/v1/auth/sync')
            .send({ id: crypto.randomUUID(), email: uniqueEmail(), role: 'admin' });

        expect(res.status).toBe(404);
    });
});

describe('service endpoints', () => {
    it('GET /health responds without touching the database', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });

    it('GET /ready confirms database connectivity', async () => {
        const res = await request(app).get('/ready');
        expect(res.status).toBe(200);
        expect(res.body.database).toBe('up');
    });

    it('unknown routes return the JSON envelope, not HTML', async () => {
        const res = await request(app).get('/api/v1/does-not-exist');

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
    });

    it('rejects an oversized request body', async () => {
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: uniqueEmail(), password: 'x'.repeat(200_000) });

        expect(res.status).toBe(413);
    });
});
