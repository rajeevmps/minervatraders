const bcrypt = require('bcryptjs');
const db = require('../../config/db');
const userRepository = require('../user/user.repository');
const tokenService = require('./token.service');
const { verifyTelegramLogin } = require('./telegramLogin');
const { bcryptRounds } = require('../../config/env');
const logger = require('../../utils/logger');

/**
 * Self-hosted authentication. Replaces Supabase Auth (GoTrue).
 *
 * Two credential types are supported and can coexist on one account:
 *   - email + password
 *   - Telegram Login Widget
 *
 * Telegram is first-class here rather than a bolt-on: it is free, it proves
 * identity cryptographically, and it yields the telegram_user_id the product
 * needs anyway to add and remove channel members.
 *
 * Note the previous `syncUser` endpoint is deliberately not reimplemented. It
 * was unauthenticated and upserted `role` straight from the request body, so
 * anyone could make themselves an admin.
 */

// A real bcrypt hash of a fixed value, compared against when no account exists
// so login timing does not reveal whether an email is registered.
const DUMMY_HASH = bcrypt.hashSync('unused-placeholder-value', 10);

class AuthError extends Error {
    constructor(message, code, status = 401) {
        super(message);
        this.name = 'AuthError';
        this.code = code;
        this.status = status;
    }
}

async function register({ email, password, fullName }, context = {}) {
    const existing = await userRepository.findByEmail(email);
    if (existing) {
        throw new AuthError('An account with this email already exists', 'EMAIL_TAKEN', 409);
    }

    const passwordHash = await bcrypt.hash(password, bcryptRounds);

    const { user, refreshToken } = await db.tx(async (t) => {
        const created = await userRepository.create({ email, passwordHash, fullName }, t);
        const issued = await tokenService.issueRefreshToken({
            userId: created.id,
            userAgent: context.userAgent,
            ipAddress: context.ipAddress,
            client: t,
        });
        return { user: created, refreshToken: issued.token };
    });

    logger.info('User registered', { userId: user.id });
    return { user, accessToken: tokenService.signAccessToken(user), refreshToken };
}

async function login({ email, password }, context = {}) {
    const account = await userRepository.findByEmailWithSecret(email);

    // Always run a comparison, even for unknown emails, so response time does
    // not distinguish "no such user" from "wrong password".
    const hash = account?.password_hash || DUMMY_HASH;
    const passwordMatches = await bcrypt.compare(password, hash);

    if (!account || !account.password_hash || !passwordMatches) {
        throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS');
    }
    if (!account.is_active) {
        throw new AuthError('This account has been disabled', 'ACCOUNT_DISABLED', 403);
    }

    const { password_hash: _omit, ...user } = account;

    const issued = await tokenService.issueRefreshToken({
        userId: user.id,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
    });
    await userRepository.markLoggedIn(user.id);

    return { user, accessToken: tokenService.signAccessToken(user), refreshToken: issued.token };
}

/**
 * Log in (or transparently register) via a verified Telegram Login payload.
 *
 * Matching order matters: an existing Telegram link wins; otherwise a brand new
 * account is created. Linking to a pre-existing *email* account is deliberately
 * NOT done here, because the widget payload carries no verified email address —
 * trusting one would let anyone claim another user's account.
 */
async function telegramLogin(payload, context = {}) {
    const verified = verifyTelegramLogin(payload);
    if (!verified.ok) {
        throw new AuthError('Telegram verification failed', `TELEGRAM_${verified.reason}`, 401);
    }

    const { telegramUserId, username, fullName, photoUrl } = verified.user;

    let user = await userRepository.findByTelegramId(telegramUserId);

    if (!user) {
        // Synthetic, non-routable address: the schema requires an email, but
        // Telegram never supplies one. The user can set a real one later.
        const placeholderEmail = `tg-${telegramUserId}@telegram.local`;
        user = await userRepository.create({
            email: placeholderEmail,
            fullName,
            telegramUserId,
            telegramUsername: username,
            avatarUrl: photoUrl,
        });
        logger.info('User registered via Telegram', { userId: user.id });
    } else if (user.telegram_username !== username) {
        user = await userRepository.update(user.id, { telegramUsername: username });
    }

    if (!user.is_active) {
        throw new AuthError('This account has been disabled', 'ACCOUNT_DISABLED', 403);
    }

    const issued = await tokenService.issueRefreshToken({
        userId: user.id,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
    });
    await userRepository.markLoggedIn(user.id);

    return { user, accessToken: tokenService.signAccessToken(user), refreshToken: issued.token };
}

/** Link Telegram to the account that is already signed in. */
async function linkTelegramToUser(userId, payload) {
    const verified = verifyTelegramLogin(payload);
    if (!verified.ok) {
        throw new AuthError('Telegram verification failed', `TELEGRAM_${verified.reason}`, 401);
    }

    const { telegramUserId, username, photoUrl } = verified.user;

    const owner = await userRepository.findByTelegramId(telegramUserId);
    if (owner && owner.id !== userId) {
        throw new AuthError(
            'This Telegram account is already linked to another user',
            'TELEGRAM_ALREADY_LINKED',
            409
        );
    }

    return userRepository.linkTelegram(userId, {
        telegramUserId,
        telegramUsername: username,
        avatarUrl: photoUrl,
    });
}

async function refresh({ refreshToken }, context = {}) {
    if (!refreshToken) {
        throw new AuthError('No refresh token supplied', 'REFRESH_MISSING');
    }
    try {
        return await tokenService.rotateRefreshToken({
            token: refreshToken,
            userAgent: context.userAgent,
            ipAddress: context.ipAddress,
        });
    } catch (error) {
        throw new AuthError('Session expired, please sign in again', error.code || 'REFRESH_FAILED');
    }
}

async function logout({ refreshToken }) {
    if (refreshToken) await tokenService.revokeRefreshToken(refreshToken);
}

/** Change password and invalidate every other session. */
async function changePassword(userId, { currentPassword, newPassword }) {
    const account = await userRepository.findByIdWithSecret(userId);
    if (!account) throw new AuthError('Account not found', 'NOT_FOUND', 404);

    // Telegram-only accounts have no password yet, so there is nothing to confirm.
    if (account.password_hash) {
        const matches = await bcrypt.compare(currentPassword || '', account.password_hash);
        if (!matches) {
            throw new AuthError('Current password is incorrect', 'INVALID_CREDENTIALS', 403);
        }
    }

    const passwordHash = await bcrypt.hash(newPassword, bcryptRounds);
    await db.tx(async (t) => {
        await userRepository.updatePassword(userId, passwordHash, t);
        await tokenService.revokeAllForUser(userId, t);
    });

    logger.info('Password changed; all sessions revoked', { userId });
}

module.exports = {
    AuthError,
    register,
    login,
    telegramLogin,
    linkTelegramToUser,
    refresh,
    logout,
    changePassword,
};
