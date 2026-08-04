const db = require('../../src/config/db');
const { createUser, createPlan, createSubscription, createTelegramAccess } = require('../helpers/factories');

jest.mock('../../src/modules/telegram/telegram.service', () => ({
    revokeAccess: jest.fn().mockResolvedValue(undefined),
    sendMessage: jest.fn().mockResolvedValue(undefined),
    generateInviteLink: jest.fn(),
    approveJoinRequest: jest.fn(),
    declineJoinRequest: jest.fn(),
    invalidateConfigCache: jest.fn(),
}));

const telegramService = require('../../src/modules/telegram/telegram.service');
const cronService = require('../../src/modules/cron/cron.service');

beforeEach(() => jest.clearAllMocks());

describe('processExpiredSubscriptions', () => {
    it('expires subscriptions past their end date', async () => {
        const user = await createUser();
        const plan = await createPlan();
        const sub = await createSubscription({ userId: user.id, planId: plan.id, daysRemaining: -1 });

        const result = await cronService.processExpiredSubscriptions();

        expect(result.expired).toBe(1);
        expect(await db.scalar(`SELECT status FROM user_subscriptions WHERE id = $1`, [sub.id])).toBe('expired');
    });

    it('leaves still-valid subscriptions alone', async () => {
        const user = await createUser();
        const plan = await createPlan();
        const sub = await createSubscription({ userId: user.id, planId: plan.id, daysRemaining: 10 });

        await cronService.processExpiredSubscriptions();

        expect(await db.scalar(`SELECT status FROM user_subscriptions WHERE id = $1`, [sub.id])).toBe('active');
    });

    it('removes the expired member from Telegram', async () => {
        const user = await createUser();
        const plan = await createPlan();
        await createSubscription({ userId: user.id, planId: plan.id, daysRemaining: -1 });
        await createTelegramAccess({ userId: user.id, telegramUserId: 424242 });

        const result = await cronService.processExpiredSubscriptions();

        expect(telegramService.revokeAccess).toHaveBeenCalledWith('424242');
        expect(result.removed).toBe(1);
    });

    it('still marks the subscription expired when Telegram removal fails', async () => {
        telegramService.revokeAccess.mockRejectedValueOnce(new Error('Telegram unavailable'));

        const user = await createUser();
        const plan = await createPlan();
        const sub = await createSubscription({ userId: user.id, planId: plan.id, daysRemaining: -1 });
        await createTelegramAccess({ userId: user.id, telegramUserId: 424243 });

        const result = await cronService.processExpiredSubscriptions();

        // The status update is committed before the API call, so an outage
        // cannot leave a lapsed subscription marked active.
        expect(await db.scalar(`SELECT status FROM user_subscriptions WHERE id = $1`, [sub.id])).toBe('expired');
        expect(result.removed).toBe(0);
    });

    it('is a no-op when nothing has expired', async () => {
        const result = await cronService.processExpiredSubscriptions();

        expect(result.expired).toBe(0);
        expect(telegramService.revokeAccess).not.toHaveBeenCalled();
    });

    it('handles many expirations in one pass', async () => {
        const plan = await createPlan();
        for (let i = 0; i < 12; i += 1) {
            const user = await createUser();
            await createSubscription({ userId: user.id, planId: plan.id, daysRemaining: -1 });
            await createTelegramAccess({ userId: user.id, telegramUserId: 500000 + i });
        }

        const result = await cronService.processExpiredSubscriptions();

        expect(result.expired).toBe(12);
        expect(telegramService.revokeAccess).toHaveBeenCalledTimes(12);
    });
});

describe('processRenewalReminders', () => {
    it('reminds subscribers expiring in exactly 3 days', async () => {
        const user = await createUser();
        const plan = await createPlan();
        await createSubscription({ userId: user.id, planId: plan.id, daysRemaining: 3 });
        await createTelegramAccess({ userId: user.id, telegramUserId: 616161 });

        await cronService.processRenewalReminders();

        expect(telegramService.sendMessage).toHaveBeenCalledWith(
            '616161',
            expect.stringMatching(/expires in 3 days/i)
        );
    });

    it('does not remind subscribers outside the reminder windows', async () => {
        const user = await createUser();
        const plan = await createPlan();
        await createSubscription({ userId: user.id, planId: plan.id, daysRemaining: 15 });
        await createTelegramAccess({ userId: user.id, telegramUserId: 616162 });

        await cronService.processRenewalReminders();

        expect(telegramService.sendMessage).not.toHaveBeenCalled();
    });

    it('skips subscribers with no linked Telegram account', async () => {
        const user = await createUser();
        const plan = await createPlan();
        await createSubscription({ userId: user.id, planId: plan.id, daysRemaining: 1 });

        const result = await cronService.processRenewalReminders();

        expect(result.sent).toBe(0);
    });
});

describe('advisory lock', () => {
    it('runs the callback when the lock is free', async () => {
        const fn = jest.fn().mockResolvedValue(undefined);

        expect(await cronService.withAdvisoryLock(fn)).toBe(true);
        expect(fn).toHaveBeenCalled();
    });

    it('releases the lock so a later run can acquire it', async () => {
        await cronService.withAdvisoryLock(async () => {});
        // Without a release the next scheduled tick would be skipped forever.
        expect(await cronService.withAdvisoryLock(async () => {})).toBe(true);
    });

    it('releases the lock even when the job throws', async () => {
        await expect(
            cronService.withAdvisoryLock(async () => {
                throw new Error('job blew up');
            })
        ).rejects.toThrow('job blew up');

        expect(await cronService.withAdvisoryLock(async () => {})).toBe(true);
    });

    it('skips the job when another holder has the lock', async () => {
        const client = await db.pool.connect();
        try {
            // Simulates a second replica already running maintenance.
            await client.query('SELECT pg_advisory_lock(4820116)');

            const fn = jest.fn();
            expect(await cronService.withAdvisoryLock(fn)).toBe(false);
            expect(fn).not.toHaveBeenCalled();
        } finally {
            await client.query('SELECT pg_advisory_unlock(4820116)');
            client.release();
        }
    });
});

describe('runMaintenance', () => {
    it('completes a full pass without throwing', async () => {
        const user = await createUser();
        const plan = await createPlan();
        await createSubscription({ userId: user.id, planId: plan.id, daysRemaining: -1 });

        await expect(cronService.runMaintenance()).resolves.toBeUndefined();
    });
});
