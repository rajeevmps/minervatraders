const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../../config/db');
const logger = require('../../utils/logger');
const {
    jwtAccessSecret,
    jwtRefreshSecret,
    accessTokenTtl,
    refreshTokenTtlDays,
} = require('../../config/env');

/**
 * Token issuance and rotation.
 *
 * Access tokens are stateless JWTs, short-lived so revocation lag is bounded.
 * Refresh tokens are opaque random strings — NOT JWTs — because they must be
 * individually revocable, which a stateless token cannot be. Only an HMAC of
 * each refresh token is stored, so a database leak yields nothing usable: the
 * attacker would also need JWT_REFRESH_SECRET, which lives outside the database.
 */

const REFRESH_TOKEN_BYTES = 48;

function hashRefreshToken(token) {
    // HMAC rather than a bare SHA-256 so stolen hashes cannot be attacked with
    // precomputed tables.
    return crypto.createHmac('sha256', jwtRefreshSecret).update(token).digest('hex');
}

function signAccessToken(user) {
    return jwt.sign(
        { sub: user.id, email: user.email, role: user.role },
        jwtAccessSecret,
        { expiresIn: accessTokenTtl, issuer: 'minerva-api' }
    );
}

function verifyAccessToken(token) {
    return jwt.verify(token, jwtAccessSecret, { issuer: 'minerva-api' });
}

/**
 * Issue a refresh token and persist its hash.
 * @param {object} opts - { userId, userAgent, ipAddress, replacesId, client }
 */
async function issueRefreshToken({ userId, userAgent, ipAddress, replacesId = null, client = db }) {
    const token = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const expiresAt = new Date(Date.now() + refreshTokenTtlDays * 24 * 60 * 60 * 1000);

    const row = await client.one(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, expires_at`,
        [userId, hashRefreshToken(token), expiresAt, userAgent || null, ipAddress || null]
    );

    if (replacesId) {
        await client.query(
            `UPDATE refresh_tokens SET revoked_at = now(), replaced_by = $1 WHERE id = $2`,
            [row.id, replacesId]
        );
    }

    return { token, id: row.id, expiresAt: row.expires_at };
}

/**
 * Exchange a refresh token for a new pair, rotating the old one.
 *
 * Presenting an already-revoked token means either a replay or a stolen token
 * being used after the legitimate client rotated it. Either way the whole
 * family is burned — the standard reuse-detection response.
 *
 * @returns {Promise<{user: object, accessToken: string, refreshToken: string, expiresAt: Date}>}
 * @throws {Error} with .code REFRESH_INVALID | REFRESH_EXPIRED | REFRESH_REUSED
 */
async function rotateRefreshToken({ token, userAgent, ipAddress }) {
    const tokenHash = hashRefreshToken(token);

    const existing = await db.one(
        `SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1`,
        [tokenHash]
    );

    if (!existing) {
        throw withCode(new Error('Refresh token not recognised'), 'REFRESH_INVALID');
    }

    // Reuse handling deliberately runs OUTSIDE a transaction. Revoking the
    // family and then throwing from inside one would roll the revocation back
    // with the rest of the transaction, so the stolen token family would
    // survive the very check meant to burn it.
    if (existing.revoked_at) {
        await revokeAllForUser(existing.user_id);
        logger.warn('Refresh token reuse detected; revoked all sessions', {
            userId: existing.user_id,
        });
        throw withCode(new Error('Refresh token already used'), 'REFRESH_REUSED');
    }

    if (new Date(existing.expires_at) <= new Date()) {
        throw withCode(new Error('Refresh token expired'), 'REFRESH_EXPIRED');
    }

    return db.tx(async (t) => {
        // Conditional UPDATE is the concurrency guard: only one caller can move
        // this row out of the un-revoked state, so two simultaneous refreshes
        // cannot both mint a token.
        const claimed = await t.one(
            `UPDATE refresh_tokens SET revoked_at = now()
              WHERE id = $1 AND revoked_at IS NULL
          RETURNING id, user_id`,
            [existing.id]
        );

        if (!claimed) {
            throw withCode(new Error('Refresh token already used'), 'REFRESH_REUSED');
        }

        const user = await t.one(
            `SELECT id, email, role, is_active FROM users WHERE id = $1`,
            [claimed.user_id]
        );

        if (!user || !user.is_active) {
            throw withCode(new Error('Account is inactive'), 'ACCOUNT_INACTIVE');
        }

        const next = await issueRefreshToken({
            userId: user.id,
            userAgent,
            ipAddress,
            replacesId: claimed.id,
            client: t,
        });

        return {
            user,
            accessToken: signAccessToken(user),
            refreshToken: next.token,
            expiresAt: next.expiresAt,
        };
    });
}

/** Revoke a single refresh token (logout). Silent if already gone. */
async function revokeRefreshToken(token) {
    await db.query(
        `UPDATE refresh_tokens
            SET revoked_at = now()
          WHERE token_hash = $1 AND revoked_at IS NULL`,
        [hashRefreshToken(token)]
    );
}

/** Revoke every active session for a user (password change, admin lockout). */
async function revokeAllForUser(userId, client = db) {
    await client.query(
        `UPDATE refresh_tokens SET revoked_at = now()
          WHERE user_id = $1 AND revoked_at IS NULL`,
        [userId]
    );
}

/** Housekeeping: drop rows well past expiry so the table does not grow forever. */
async function purgeExpired() {
    const { rowCount } = await db.query(
        `DELETE FROM refresh_tokens WHERE expires_at < now() - interval '30 days'`
    );
    return rowCount;
}

function withCode(error, code) {
    error.code = code;
    return error;
}

module.exports = {
    signAccessToken,
    verifyAccessToken,
    issueRefreshToken,
    rotateRefreshToken,
    revokeRefreshToken,
    revokeAllForUser,
    purgeExpired,
};
