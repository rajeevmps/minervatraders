const db = require('../../config/db');

/**
 * System settings (key/value).
 *
 * Keys are restricted to a whitelist. The previous implementation wrote every
 * key present in the request body, so an admin request could create unbounded
 * arbitrary rows.
 *
 * SECRET_KEYS are write-only: they are never returned by getSettings, so the
 * bot token cannot be read back out through the admin API once set.
 */

const ALLOWED_KEYS = Object.freeze([
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_CHANNEL_ID',
    'TELEGRAM_CHANNEL_NAME',
    'SUPPORT_EMAIL',
    'SUPPORT_TELEGRAM',
    'SITE_ANNOUNCEMENT',
    'MAINTENANCE_MODE',
]);

const SECRET_KEYS = Object.freeze(['TELEGRAM_BOT_TOKEN']);

const isAllowed = (key) => ALLOWED_KEYS.includes(key);

/** All settings as a plain object, with secret values masked. */
async function getSettings() {
    const rows = await db.many(`SELECT key, value FROM system_settings ORDER BY key`);

    return rows.reduce((acc, row) => {
        acc[row.key] = SECRET_KEYS.includes(row.key)
            ? maskSecret(row.value)
            : row.value;
        return acc;
    }, {});
}

/** Raw values, for internal service use only. Never send these to a client. */
async function getRawSettings(keys) {
    const rows = await db.many(
        `SELECT key, value FROM system_settings WHERE key = ANY($1::text[])`,
        [keys]
    );
    return rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
}

/**
 * Upsert many settings atomically. The previous version fired N independent
 * upserts through Promise.all, so a partial failure left settings half-applied.
 */
async function updateSettings(settings) {
    const entries = Object.entries(settings).filter(([key]) => isAllowed(key));
    const rejected = Object.keys(settings).filter((key) => !isAllowed(key));

    if (entries.length > 0) {
        await db.tx(async (t) => {
            for (const [key, value] of entries) {
                // A masked value means "unchanged" — do not overwrite the real
                // secret with the mask the UI displayed back to us.
                if (SECRET_KEYS.includes(key) && isMasked(value)) continue;

                await t.query(
                    `INSERT INTO system_settings (key, value)
                     VALUES ($1, $2)
                     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
                    [key, value === null || value === undefined ? null : String(value)]
                );
            }
        });
    }

    return { updated: entries.map(([key]) => key), rejected };
}

const maskSecret = (value) =>
    !value ? null : `${'•'.repeat(8)}${String(value).slice(-4)}`;

const isMasked = (value) => typeof value === 'string' && value.startsWith('••••');

module.exports = { ALLOWED_KEYS, SECRET_KEYS, getSettings, getRawSettings, updateSettings };
