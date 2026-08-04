const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/config/db');
const { createUser, createPlan, createSubscription, createTelegramAccess } = require('../helpers/factories');
const { createAndSignIn } = require('../helpers/auth');

jest.mock('../../src/modules/telegram/telegram.service', () => ({
    generateInviteLink: jest.fn().mockResolvedValue('https://t.me/+generated'),
    revokeAccess: jest.fn().mockResolvedValue(undefined),
    sendMessage: jest.fn().mockResolvedValue(undefined),
    approveJoinRequest: jest.fn().mockResolvedValue(undefined),
    declineJoinRequest: jest.fn().mockResolvedValue(undefined),
    invalidateConfigCache: jest.fn(),
    getTelegramConfig: jest.fn().mockResolvedValue({ botToken: 'x', channelId: '-100' }),
}));

const telegramService = require('../../src/modules/telegram/telegram.service');
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

const withSecret = (req) => req.set('X-Telegram-Bot-Api-Secret-Token', WEBHOOK_SECRET);

beforeEach(() => jest.clearAllMocks());

describe('GET /api/v1/telegram/invite', () => {
    it('requires authentication', async () => {
        expect((await request(app).get('/api/v1/telegram/invite')).status).toBe(401);
    });

    it('refuses a user with no active subscription', async () => {
        const { accessToken } = await createAndSignIn();
        const res = await request(app)
            .get('/api/v1/telegram/invite')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('SUBSCRIPTION_REQUIRED');
        expect(telegramService.generateInviteLink).not.toHaveBeenCalled();
    });

    it('refuses a user whose subscription has lapsed', async () => {
        const { accessToken, dbUser } = await createAndSignIn();
        const plan = await createPlan();
        // Still marked active, but end_date is in the past.
        await createSubscription({ userId: dbUser.id, planId: plan.id, daysRemaining: -1 });

        const res = await request(app)
            .get('/api/v1/telegram/invite')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.status).toBe(403);
    });

    it('generates an invite for an active subscriber', async () => {
        const { accessToken, dbUser } = await createAndSignIn();
        const plan = await createPlan();
        await createSubscription({ userId: dbUser.id, planId: plan.id });

        const res = await request(app)
            .get('/api/v1/telegram/invite')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.inviteLink).toBe('https://t.me/+generated');
    });

    it('reuses a still-valid invite instead of minting a new one', async () => {
        const { accessToken, dbUser } = await createAndSignIn();
        const plan = await createPlan();
        await createSubscription({ userId: dbUser.id, planId: plan.id });
        await db.query(
            `INSERT INTO telegram_access (user_id, invite_link, status, expires_at)
             VALUES ($1, 'https://t.me/+existing', 'invited', now() + interval '1 hour')`,
            [dbUser.id]
        );

        const res = await request(app)
            .get('/api/v1/telegram/invite')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.body.data.inviteLink).toBe('https://t.me/+existing');
        // Each createChatInviteLink call leaves another live invite on the
        // channel, so reuse matters.
        expect(telegramService.generateInviteLink).not.toHaveBeenCalled();
    });

    it('replaces an expired invite', async () => {
        const { accessToken, dbUser } = await createAndSignIn();
        const plan = await createPlan();
        await createSubscription({ userId: dbUser.id, planId: plan.id });
        await db.query(
            `INSERT INTO telegram_access (user_id, invite_link, status, expires_at)
             VALUES ($1, 'https://t.me/+stale', 'invited', now() - interval '1 hour')`,
            [dbUser.id]
        );

        const res = await request(app)
            .get('/api/v1/telegram/invite')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.body.data.inviteLink).toBe('https://t.me/+generated');
        expect(telegramService.generateInviteLink).toHaveBeenCalledTimes(1);
    });
});

describe('GET /api/v1/telegram/status', () => {
    it('reports unlinked by default', async () => {
        const { accessToken } = await createAndSignIn();
        const res = await request(app)
            .get('/api/v1/telegram/status')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.linked).toBe(false);
    });

    it('reports linked once an account is connected', async () => {
        const { accessToken, dbUser } = await createAndSignIn();
        await createTelegramAccess({ userId: dbUser.id, telegramUserId: 777001 });

        const res = await request(app)
            .get('/api/v1/telegram/status')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.body.data.linked).toBe(true);
    });
});

describe('POST /api/v1/telegram/webhook', () => {
    it('rejects a delivery with no secret token', async () => {
        const res = await request(app).post('/api/v1/telegram/webhook').send({ message: {} });

        // The endpoint previously had no authentication at all.
        expect(res.status).toBe(401);
    });

    it('rejects a delivery with the wrong secret token', async () => {
        const res = await request(app)
            .post('/api/v1/telegram/webhook')
            .set('X-Telegram-Bot-Api-Secret-Token', 'wrong-secret')
            .send({ message: {} });

        expect(res.status).toBe(401);
    });

    it('accepts a correctly authenticated delivery', async () => {
        const res = await withSecret(request(app).post('/api/v1/telegram/webhook')).send({});
        expect(res.status).toBe(200);
    });

    describe('/start deep link', () => {
        const startMessage = (text, fromId = 888001) => ({
            message: { text, chat: { id: fromId }, from: { id: fromId, username: 'linker' } },
        });

        it('links a Telegram account to a valid user id', async () => {
            const user = await createUser();

            await withSecret(request(app).post('/api/v1/telegram/webhook'))
                .send(startMessage(`/start ${user.id}`));

            const access = await db.one(`SELECT telegram_user_id FROM telegram_access WHERE user_id = $1`, [user.id]);
            expect(String(access.telegram_user_id)).toBe('888001');

            // Mirrored onto users so Telegram sign-in works afterwards.
            const row = await db.one(`SELECT telegram_user_id FROM users WHERE id = $1`, [user.id]);
            expect(String(row.telegram_user_id)).toBe('888001');
        });

        it('rejects a malformed user id without touching the database', async () => {
            await withSecret(request(app).post('/api/v1/telegram/webhook'))
                .send(startMessage('/start not-a-uuid'));

            expect(await db.scalar(`SELECT count(*)::int FROM telegram_access`)).toBe(0);
            expect(telegramService.sendMessage).toHaveBeenCalledWith(888001, expect.stringMatching(/not valid/i));
        });

        it('rejects an unknown user id', async () => {
            await withSecret(request(app).post('/api/v1/telegram/webhook'))
                .send(startMessage('/start 00000000-0000-0000-0000-000000000000'));

            expect(await db.scalar(`SELECT count(*)::int FROM telegram_access`)).toBe(0);
        });

        it('refuses to let one Telegram account claim a second user', async () => {
            const first = await createUser();
            const second = await createUser();

            await withSecret(request(app).post('/api/v1/telegram/webhook'))
                .send(startMessage(`/start ${first.id}`));
            await withSecret(request(app).post('/api/v1/telegram/webhook'))
                .send(startMessage(`/start ${second.id}`));

            expect(await db.scalar(
                `SELECT count(*)::int FROM telegram_access WHERE telegram_user_id = 888001`
            )).toBe(1);
        });

        it('prompts when /start carries no payload', async () => {
            await withSecret(request(app).post('/api/v1/telegram/webhook')).send(startMessage('/start'));

            expect(telegramService.sendMessage).toHaveBeenCalledWith(
                888001,
                expect.stringMatching(/Connect Telegram/i)
            );
        });
    });

    describe('join requests', () => {
        const joinRequest = (telegramUserId = 999001) => ({
            chat_join_request: { chat: { id: -100 }, from: { id: telegramUserId } },
        });

        it('declines an unlinked account', async () => {
            await withSecret(request(app).post('/api/v1/telegram/webhook')).send(joinRequest());

            expect(telegramService.declineJoinRequest).toHaveBeenCalled();
            expect(telegramService.approveJoinRequest).not.toHaveBeenCalled();
        });

        it('declines a linked account with no active subscription', async () => {
            const user = await createUser();
            await createTelegramAccess({ userId: user.id, telegramUserId: 999001 });

            await withSecret(request(app).post('/api/v1/telegram/webhook')).send(joinRequest());

            expect(telegramService.declineJoinRequest).toHaveBeenCalled();
            expect(telegramService.approveJoinRequest).not.toHaveBeenCalled();
        });

        it('approves a linked, actively subscribed account', async () => {
            const user = await createUser();
            const plan = await createPlan();
            await createSubscription({ userId: user.id, planId: plan.id });
            await createTelegramAccess({ userId: user.id, telegramUserId: 999001 });

            await withSecret(request(app).post('/api/v1/telegram/webhook')).send(joinRequest());

            expect(telegramService.approveJoinRequest).toHaveBeenCalled();
            const access = await db.one(`SELECT status, joined_at FROM telegram_access WHERE user_id = $1`, [user.id]);
            expect(access.status).toBe('joined');
            expect(access.joined_at).not.toBeNull();
        });

        it('declines when the subscription has lapsed', async () => {
            const user = await createUser();
            const plan = await createPlan();
            await createSubscription({ userId: user.id, planId: plan.id, daysRemaining: -5 });
            await createTelegramAccess({ userId: user.id, telegramUserId: 999001 });

            await withSecret(request(app).post('/api/v1/telegram/webhook')).send(joinRequest());

            expect(telegramService.declineJoinRequest).toHaveBeenCalled();
        });
    });
});
