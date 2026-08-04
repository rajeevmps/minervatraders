const { Pool } = require('pg');
const { databaseUrl, databasePoolMax, isProduction } = require('./env');
const logger = require('../utils/logger');

/**
 * Postgres access layer.
 *
 * Replaces the Supabase client. Two deliberate behavioural differences from the
 * old `{ data, error }` style:
 *
 *   1. Failures THROW. Call sites use try/catch and let errorHandler respond,
 *      rather than branching on a returned `error` object and silently
 *      continuing when they forget to.
 *   2. "Not found" is `null` from one(), never an error. The Supabase code
 *      detected this by string-matching the PostgREST code 'PGRST116', which
 *      no longer exists.
 */

const pool = new Pool({
    connectionString: databaseUrl,
    max: databasePoolMax,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // Managed providers terminate unencrypted connections; local dev has no TLS.
    ssl: isProduction ? { rejectUnauthorized: false } : false,
});

// An idle client erroring (e.g. the server restarted) must not take the process
// down via an unhandled 'error' event.
pool.on('error', (err) => {
    logger.error('Idle Postgres client error', { error: err.message });
});

const SLOW_QUERY_MS = 200;

async function query(text, params = []) {
    const startedAt = process.hrtime.bigint();
    try {
        const result = await pool.query(text, params);
        const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        if (elapsedMs > SLOW_QUERY_MS) {
            logger.warn('Slow query', { ms: Math.round(elapsedMs), sql: squash(text) });
        }
        return result;
    } catch (err) {
        // Log the statement but never the parameters, which carry user data.
        logger.error('Query failed', { sql: squash(text), code: err.code, error: err.message });
        throw err;
    }
}

/** First row, or null when there are none. */
async function one(text, params = []) {
    const { rows } = await query(text, params);
    return rows.length > 0 ? rows[0] : null;
}

/** All rows. */
async function many(text, params = []) {
    const { rows } = await query(text, params);
    return rows;
}

/** Single scalar from the first row, or null. */
async function scalar(text, params = []) {
    const row = await one(text, params);
    if (row === null) return null;
    return Object.values(row)[0];
}

/**
 * Run `fn` inside a transaction on a dedicated client.
 *
 * The callback receives a scoped handle with the same query/one/many/scalar
 * surface, so repository helpers work unchanged inside a transaction:
 *
 *   await db.tx(async (t) => {
 *     const order = await t.one('INSERT INTO orders ... RETURNING *', [...]);
 *     await t.query('INSERT INTO order_items ...', [order.id, ...]);
 *     return order;
 *   });
 */
async function tx(fn) {
    const client = await pool.connect();
    const scoped = {
        query: (text, params = []) => client.query(text, params),
        one: async (text, params = []) => {
            const { rows } = await client.query(text, params);
            return rows.length > 0 ? rows[0] : null;
        },
        many: async (text, params = []) => (await client.query(text, params)).rows,
        scalar: async (text, params = []) => {
            const { rows } = await client.query(text, params);
            return rows.length > 0 ? Object.values(rows[0])[0] : null;
        },
    };

    try {
        await client.query('BEGIN');
        const result = await fn(scoped);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackErr) {
            logger.error('Rollback failed', { error: rollbackErr.message });
        }
        throw err;
    } finally {
        client.release();
    }
}

/** Verify connectivity at boot. Throws so server.js can refuse to start. */
async function connectDB() {
    const row = await one('SELECT current_database() AS db, version() AS version');
    logger.info('Postgres connected', { database: row.db });
    return row;
}

/** Cheap liveness probe for /health — does not allocate a new connection. */
async function healthCheck() {
    await query('SELECT 1');
    return { pool: { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount } };
}

async function close() {
    await pool.end();
}

/** Collapse whitespace so multi-line SQL logs on a single line. */
function squash(text) {
    return text.replace(/\s+/g, ' ').trim().slice(0, 300);
}

module.exports = { pool, query, one, many, scalar, tx, connectDB, healthCheck, close };
