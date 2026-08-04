const db = require('../../config/db');
const telegramService = require('./telegram.service');
const { sendResponse } = require('../../utils/responseHelper');

/**
 * Issue (or reuse) a single-use channel invite for the signed-in user.
 *
 * Reuse matters: createChatInviteLink makes a NEW link every call, so
 * regenerating on each request would leave a trail of unused live invites on
 * the channel.
 */
exports.getInviteLink = async (req, res, next) => {
    try {
        const userId = req.user.id;

        // Subscription state and any existing invite in one round trip.
        const row = await db.one(
            `SELECT s.id AS subscription_id,
                    ta.invite_link,
                    ta.expires_at,
                    ta.status
               FROM users u
               LEFT JOIN user_subscriptions s
                      ON s.user_id = u.id AND s.status = 'active' AND s.end_date >= now()
               LEFT JOIN telegram_access ta
                      ON ta.user_id = u.id
              WHERE u.id = $1`,
            [userId]
        );

        if (!row || !row.subscription_id) {
            return sendResponse(
                res,
                403,
                false,
                'An active subscription is required to join the Telegram channel.',
                null,
                { code: 'SUBSCRIPTION_REQUIRED' }
            );
        }

        const stillValid =
            row.invite_link &&
            row.status !== 'revoked' &&
            row.expires_at &&
            new Date(row.expires_at) > new Date();

        if (stillValid) {
            return sendResponse(res, 200, true, 'Invite link retrieved', {
                inviteLink: row.invite_link,
                expiresAt: row.expires_at,
            });
        }

        // telegram_access.user_id is UNIQUE and the service upserts on it, so a
        // stale row is replaced rather than causing a conflict.
        const inviteLink = await telegramService.generateInviteLink(userId);

        return sendResponse(res, 200, true, 'Invite link generated', { inviteLink });
    } catch (error) {
        return next(error);
    }
};

/** Current Telegram link status for the dashboard. */
exports.getLinkStatus = async (req, res, next) => {
    try {
        const row = await db.one(
            `SELECT telegram_user_id, telegram_username, status, joined_at, expires_at, is_active
               FROM telegram_access
              WHERE user_id = $1`,
            [req.user.id]
        );

        return sendResponse(res, 200, true, 'Telegram status retrieved', {
            linked: Boolean(row?.telegram_user_id),
            telegramUsername: row?.telegram_username ?? null,
            status: row?.status ?? null,
            joinedAt: row?.joined_at ?? null,
        });
    } catch (error) {
        return next(error);
    }
};
