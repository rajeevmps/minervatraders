const cron = require('node-cron');
const db = require('../../config/db');
const telegramService = require('../telegram/telegram.service');
const tokenService = require('../auth/token.service');
const logger = require('../../utils/logger');

/**
 * Scheduled maintenance: expire lapsed subscriptions, send renewal reminders,
 * purge dead refresh tokens.
 *
 * Guarded by a Postgres advisory lock. node-cron fires independently in every
 * process, so without the lock two replicas would both kick the same members.
 * The lock also means an overrunning job cannot overlap with its next tick.
 */

// Arbitrary but fixed application-wide identifier for the maintenance lock.
const ADVISORY_LOCK_KEY = 4820116;
const BATCH_SIZE = 25;
const REMINDER_DAYS = [1, 3];

let scheduledTask = null;

/**
 * Run `fn` only if the advisory lock is free. The lock is session-scoped, so it
 * is taken and released on one dedicated connection.
 */
async function withAdvisoryLock(fn) {
    const client = await db.pool.connect();
    try {
        const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS acquired', [
            ADVISORY_LOCK_KEY,
        ]);
        if (!rows[0].acquired) {
            logger.info('Maintenance job already running elsewhere; skipping this tick');
            return false;
        }
        try {
            await fn();
            return true;
        } finally {
            await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]);
        }
    } finally {
        client.release();
    }
}

/**
 * Expire subscriptions past end_date and remove those members from Telegram.
 *
 * The status update is committed BEFORE the Telegram call. If the API call
 * fails the subscription is still correctly marked expired, and the member is
 * retried on the next run via the still-active telegram_access row.
 */
async function processExpiredSubscriptions() {
    const expired = await db.many(
        `UPDATE user_subscriptions s
            SET status = 'expired'
          WHERE s.status = 'active' AND s.end_date < now()
      RETURNING s.id, s.user_id`
    );

    if (expired.length === 0) {
        logger.info('No expired subscriptions');
        return { expired: 0, removed: 0 };
    }

    logger.info(`Expiring ${expired.length} subscriptions`);

    const userIds = expired.map((row) => row.user_id);
    const members = await db.many(
        `SELECT ta.user_id, ta.telegram_user_id
           FROM telegram_access ta
          WHERE ta.user_id = ANY($1::uuid[])
            AND ta.telegram_user_id IS NOT NULL
            AND ta.is_active`,
        [userIds]
    );

    let removed = 0;

    for (const batch of chunk(members, BATCH_SIZE)) {
        const results = await Promise.allSettled(
            batch.map(async (member) => {
                await telegramService.revokeAccess(member.telegram_user_id);
                await telegramService.sendMessage(
                    member.telegram_user_id,
                    'Your subscription has expired and channel access has been removed. Renew from your dashboard to rejoin.'
                );
            })
        );

        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                removed += 1;
            } else {
                logger.error('Failed to remove expired member', {
                    telegramUserId: batch[index].telegram_user_id,
                    error: result.reason?.message,
                });
            }
        });

        // Telegram rate limits aggressively; pace the batches.
        await sleep(500);
    }

    return { expired: expired.length, removed };
}

/** Warn subscribers whose access lapses in REMINDER_DAYS days. */
async function processRenewalReminders() {
    let sent = 0;

    for (const days of REMINDER_DAYS) {
        // Day bucketing happens in Postgres so it follows the database's clock
        // rather than the Node process's local timezone.
        const due = await db.many(
            `SELECT s.id, s.end_date, ta.telegram_user_id
               FROM user_subscriptions s
               JOIN telegram_access ta ON ta.user_id = s.user_id
              WHERE s.status = 'active'
                AND ta.telegram_user_id IS NOT NULL
                AND ta.is_active
                AND s.end_date::date = (now() + make_interval(days => $1))::date`,
            [days]
        );

        for (const batch of chunk(due, BATCH_SIZE)) {
            await Promise.allSettled(
                batch.map((row) =>
                    telegramService.sendMessage(
                        row.telegram_user_id,
                        `Reminder: your subscription expires in ${days} day${days > 1 ? 's' : ''}. Renew from your dashboard to keep access.`
                    )
                )
            );
            sent += batch.length;
            await sleep(500);
        }
    }

    if (sent > 0) logger.info(`Sent ${sent} renewal reminders`);
    return { sent };
}

/** One maintenance pass. Exported so it can be invoked directly and tested. */
async function runMaintenance() {
    const startedAt = Date.now();
    try {
        const expiry = await processExpiredSubscriptions();
        const reminders = await processRenewalReminders();
        const purged = await tokenService.purgeExpired();

        logger.info('Maintenance complete', {
            ...expiry,
            ...reminders,
            purgedTokens: purged,
            ms: Date.now() - startedAt,
        });
    } catch (error) {
        logger.error('Maintenance run failed', { error: error.message });
    }
}

/**
 * Register the schedule. Called explicitly from server.js — NOT at module load,
 * which previously meant the scheduler also started during test runs.
 */
function initCronJobs() {
    if (scheduledTask) return scheduledTask;

    scheduledTask = cron.schedule('0 0,12 * * *', () => withAdvisoryLock(runMaintenance));
    logger.info('Maintenance cron scheduled (00:00 and 12:00)');
    return scheduledTask;
}

function stopCronJobs() {
    if (scheduledTask) {
        scheduledTask.stop();
        scheduledTask = null;
    }
}

const chunk = (items, size) =>
    Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
        items.slice(i * size, i * size + size)
    );

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = {
    initCronJobs,
    stopCronJobs,
    runMaintenance,
    withAdvisoryLock,
    processExpiredSubscriptions,
    processRenewalReminders,
};
