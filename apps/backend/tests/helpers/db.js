const db = require('../../src/config/db');

/**
 * Tables cleared between tests, child-first. TRUNCATE ... CASCADE handles the
 * ordering anyway, but listing them explicitly means a newly added table is a
 * visible omission rather than a silent source of cross-test leakage.
 *
 * `pgmigrations` is excluded — wiping it would strand the schema.
 */
const TABLES = [
    'audit_logs',
    'webhook_logs',
    'telegram_access',
    'payments',
    'order_items',
    'orders',
    'user_subscriptions',
    'addresses',
    'refresh_tokens',
    'subscription_plans',
    'users',
    'system_settings',
];

/** Wipe all application data. Fast enough to run before every test. */
async function truncateAll() {
    await db.query(`TRUNCATE TABLE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);
}

async function closeDb() {
    await db.close();
}

module.exports = { TABLES, truncateAll, closeDb };
