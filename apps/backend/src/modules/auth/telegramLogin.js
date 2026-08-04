const crypto = require('crypto');
const { telegramBotToken } = require('../../config/env');

/**
 * Telegram Login Widget payload verification.
 *
 * Telegram signs the widget payload with HMAC-SHA256 using SHA256(bot_token)
 * as the key. Because only Telegram and the bot owner know the token, a valid
 * signature proves the payload really came from Telegram and was not tampered
 * with — which is what makes this a free, verified identity source.
 *
 * Reference: https://core.telegram.org/widgets/login#checking-authorization
 */

// Widget payloads older than this are refused so a captured URL cannot be
// replayed indefinitely.
const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60;

/**
 * @param {object} payload - raw widget fields incl. `hash`
 * @returns {{ok: true, user: object} | {ok: false, reason: string}}
 */
function verifyTelegramLogin(payload) {
    if (!telegramBotToken) {
        return { ok: false, reason: 'TELEGRAM_NOT_CONFIGURED' };
    }
    if (!payload || typeof payload !== 'object' || !payload.hash) {
        return { ok: false, reason: 'MISSING_HASH' };
    }

    const { hash, ...fields } = payload;

    // Every field except `hash`, sorted by key, as `key=value` joined by \n.
    const dataCheckString = Object.keys(fields)
        .filter((key) => fields[key] !== undefined && fields[key] !== null)
        .sort()
        .map((key) => `${key}=${fields[key]}`)
        .join('\n');

    const secretKey = crypto.createHash('sha256').update(telegramBotToken).digest();
    const expected = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

    if (!timingSafeEqualHex(expected, String(hash))) {
        return { ok: false, reason: 'BAD_SIGNATURE' };
    }

    const authDate = Number(fields.auth_date);
    if (!Number.isFinite(authDate)) {
        return { ok: false, reason: 'BAD_AUTH_DATE' };
    }
    if (Math.floor(Date.now() / 1000) - authDate > MAX_AUTH_AGE_SECONDS) {
        return { ok: false, reason: 'AUTH_EXPIRED' };
    }

    const telegramUserId = Number(fields.id);
    if (!Number.isSafeInteger(telegramUserId)) {
        return { ok: false, reason: 'BAD_USER_ID' };
    }

    return {
        ok: true,
        user: {
            telegramUserId,
            username: fields.username || null,
            fullName: [fields.first_name, fields.last_name].filter(Boolean).join(' ') || null,
            photoUrl: fields.photo_url || null,
            authDate,
        },
    };
}

/** Constant-time compare of two hex strings of equal length. */
function timingSafeEqualHex(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
        return false;
    }
    try {
        return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
    } catch {
        return false;
    }
}

module.exports = { verifyTelegramLogin, MAX_AUTH_AGE_SECONDS };
