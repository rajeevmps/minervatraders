const crypto = require('crypto');
const { verifyTelegramLogin } = require('../../src/modules/auth/telegramLogin');

/**
 * Telegram Login Widget signature verification.
 *
 * This is the entire trust boundary for Telegram sign-in: if it accepts a
 * forged payload, anyone can log in as anyone.
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/** Sign a payload exactly the way Telegram does. */
function sign(fields, botToken = BOT_TOKEN) {
    const dataCheckString = Object.keys(fields)
        .sort()
        .map((key) => `${key}=${fields[key]}`)
        .join('\n');
    const secretKey = crypto.createHash('sha256').update(botToken).digest();
    return crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
}

const validPayload = (overrides = {}) => {
    const fields = {
        id: 123456789,
        first_name: 'Ada',
        last_name: 'Lovelace',
        username: 'ada',
        auth_date: Math.floor(Date.now() / 1000),
        ...overrides,
    };
    return { ...fields, hash: sign(fields) };
};

describe('verifyTelegramLogin', () => {
    it('accepts a correctly signed payload', () => {
        const result = verifyTelegramLogin(validPayload());

        expect(result.ok).toBe(true);
        expect(result.user).toMatchObject({
            telegramUserId: 123456789,
            username: 'ada',
            fullName: 'Ada Lovelace',
        });
    });

    it('rejects a payload with no hash', () => {
        const { hash: _drop, ...unsigned } = validPayload();
        expect(verifyTelegramLogin(unsigned)).toEqual({ ok: false, reason: 'MISSING_HASH' });
    });

    it('rejects a tampered field even when the hash is well-formed', () => {
        const payload = validPayload();
        // Attacker swaps in a different Telegram id, keeping the original hash.
        payload.id = 999999999;

        expect(verifyTelegramLogin(payload)).toEqual({ ok: false, reason: 'BAD_SIGNATURE' });
    });

    it('rejects a payload signed with a different bot token', () => {
        const fields = {
            id: 123456789,
            first_name: 'Mallory',
            auth_date: Math.floor(Date.now() / 1000),
        };
        const forged = { ...fields, hash: sign(fields, 'attacker-controlled-token') };

        expect(verifyTelegramLogin(forged)).toEqual({ ok: false, reason: 'BAD_SIGNATURE' });
    });

    it('rejects a correctly signed but stale payload (replay)', () => {
        const twoDaysAgo = Math.floor(Date.now() / 1000) - 2 * 24 * 60 * 60;

        expect(verifyTelegramLogin(validPayload({ auth_date: twoDaysAgo }))).toEqual({
            ok: false,
            reason: 'AUTH_EXPIRED',
        });
    });

    it('accepts a payload from just inside the freshness window', () => {
        const almostADayAgo = Math.floor(Date.now() / 1000) - (24 * 60 * 60 - 60);
        expect(verifyTelegramLogin(validPayload({ auth_date: almostADayAgo })).ok).toBe(true);
    });

    it('rejects a non-numeric auth_date', () => {
        const fields = { id: 1, auth_date: 'not-a-date' };
        expect(verifyTelegramLogin({ ...fields, hash: sign(fields) })).toEqual({
            ok: false,
            reason: 'BAD_AUTH_DATE',
        });
    });

    it('rejects a non-numeric telegram id', () => {
        const fields = { id: 'abc', auth_date: Math.floor(Date.now() / 1000) };
        expect(verifyTelegramLogin({ ...fields, hash: sign(fields) })).toEqual({
            ok: false,
            reason: 'BAD_USER_ID',
        });
    });

    it('rejects junk input without throwing', () => {
        expect(verifyTelegramLogin(null).ok).toBe(false);
        expect(verifyTelegramLogin(undefined).ok).toBe(false);
        expect(verifyTelegramLogin('nonsense').ok).toBe(false);
        expect(verifyTelegramLogin({ hash: 'zz-not-hex' }).ok).toBe(false);
    });

    it('still verifies when Telegram adds an unknown field', () => {
        // The HMAC covers every field, so unknown keys must be included in the
        // check rather than stripped.
        const result = verifyTelegramLogin(validPayload({ photo_url: 'https://t.me/x.jpg' }));
        expect(result.ok).toBe(true);
    });
});
