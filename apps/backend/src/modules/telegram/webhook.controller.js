const db = require('../../config/db');
const telegramService = require('./telegram.service');
const subscriptionService = require('../subscription/subscription.service');
const logger = require('../../utils/logger');

/**
 * Telegram Bot API webhook.
 *
 * Always answers 200, even on failure — a non-2xx makes Telegram retry the same
 * update indefinitely. Failures are logged instead.
 *
 * Authenticity is established by the secret-token header check in the route
 * (verifyTelegramWebhook), not here.
 */
exports.handleTelegramWebhook = async (req, res) => {
    try {
        const update = req.body;

        if (update?.message?.text?.startsWith('/start')) {
            await handleStartCommand(update.message);
        } else if (update?.chat_join_request) {
            await handleJoinRequest(update.chat_join_request);
        }
    } catch (error) {
        logger.error('Telegram webhook processing failed', { error: error.message });
    }

    // Acknowledged after processing. Each handler is a couple of queries plus
    // one Bot API call, comfortably inside Telegram's timeout — and responding
    // first would make the outcome unobservable to callers and tests alike.
    res.status(200).send('ok');
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Identity linking via `/start <userId>` deep link. */
async function handleStartCommand(message) {
    const chatId = message.chat.id;
    const telegramUserId = message.from.id;
    const telegramUsername = message.from.username || null;

    const [, userId] = message.text.trim().split(/\s+/);

    if (!userId) {
        return telegramService.sendMessage(
            chatId,
            'Please use the "Connect Telegram" button on your dashboard to link your account.'
        );
    }
    if (!UUID_PATTERN.test(userId)) {
        return telegramService.sendMessage(chatId, 'That connection link is not valid.');
    }

    const user = await db.one(`SELECT id FROM users WHERE id = $1`, [userId]);
    if (!user) {
        return telegramService.sendMessage(
            chatId,
            'Account not found. Please sign in and try connecting again.'
        );
    }

    // A Telegram account must not be claimable by two different users.
    const conflicting = await db.one(
        `SELECT user_id FROM telegram_access
          WHERE telegram_user_id = $1 AND user_id <> $2`,
        [telegramUserId, userId]
    );
    if (conflicting) {
        return telegramService.sendMessage(
            chatId,
            'This Telegram account is already linked to a different subscriber.'
        );
    }

    await db.query(
        `INSERT INTO telegram_access (user_id, telegram_user_id, telegram_username, is_active)
         VALUES ($1, $2, $3, TRUE)
         ON CONFLICT (user_id) DO UPDATE
            SET telegram_user_id  = EXCLUDED.telegram_user_id,
                telegram_username = EXCLUDED.telegram_username,
                is_active         = TRUE`,
        [userId, telegramUserId, telegramUsername]
    );

    // Mirror onto users so Telegram sign-in works for this account afterwards.
    await db.query(
        `UPDATE users
            SET telegram_user_id = $2, telegram_username = $3
          WHERE id = $1 AND (telegram_user_id IS NULL OR telegram_user_id = $2)`,
        [userId, telegramUserId, telegramUsername]
    );

    logger.info('Telegram account linked', { userId, telegramUserId });
    await telegramService.sendMessage(
        chatId,
        '✅ Account linked. You can now request to join the private channel.'
    );
}

/** Approve or decline a channel join request based on subscription state. */
async function handleJoinRequest(request) {
    const telegramUserId = request.from.id;
    const chatId = request.chat.id;

    const access = await db.one(
        `SELECT user_id FROM telegram_access WHERE telegram_user_id = $1`,
        [telegramUserId]
    );

    if (!access) {
        await telegramService.declineJoinRequest(chatId, telegramUserId);
        await telegramService.sendMessage(
            telegramUserId,
            '❌ Your Telegram account is not linked. Open your dashboard and click "Connect Telegram" first.'
        );
        return;
    }

    // getActiveSubscription already filters on status and end_date, and returns
    // null rather than throwing when there is none — the old PGRST116 branch
    // that used to handle that no longer exists.
    const subscription = await subscriptionService.getActiveSubscription(access.user_id);

    if (!subscription) {
        await telegramService.declineJoinRequest(chatId, telegramUserId);
        await telegramService.sendMessage(
            telegramUserId,
            '⚠️ No active subscription found. Please subscribe to join.'
        );
        return;
    }

    await telegramService.approveJoinRequest(chatId, telegramUserId);
    await telegramService.sendMessage(
        telegramUserId,
        '🎉 Request approved — welcome to the premium channel.'
    );

    await db.query(
        `UPDATE telegram_access
            SET joined_at = now(), status = 'joined'
          WHERE telegram_user_id = $1`,
        [telegramUserId]
    );
}
