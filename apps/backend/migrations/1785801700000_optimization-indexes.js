/* eslint-disable camelcase */

/**
 * Indexes for access patterns that were missed in the initial schema.
 *
 * telegram_access.telegram_user_id is looked up on every Telegram webhook
 * delivery (`/start` linking, join-request approval, revoke-on-expiry), but
 * had no index — each of those became a full table scan. Traffic-driven,
 * unlike the cron job's twice-daily scan, so this one matters at real scale
 * even though the table starts small.
 *
 * payments(status) speeds the admin dashboard's revenue sum, which filters on
 * status = 'captured'. A partial index keeps it small since most rows will
 * eventually be in a small number of terminal states.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
    pgm.sql(`
    CREATE INDEX idx_telegram_access_telegram_user_id
      ON telegram_access(telegram_user_id)
      WHERE telegram_user_id IS NOT NULL;

    CREATE INDEX idx_payments_status_captured
      ON payments(status)
      WHERE status = 'captured';
  `);
};

exports.down = (pgm) => {
    pgm.sql(`
    DROP INDEX IF EXISTS idx_telegram_access_telegram_user_id;
    DROP INDEX IF EXISTS idx_payments_status_captured;
  `);
};
