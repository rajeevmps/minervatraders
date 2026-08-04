const axios = require('axios');
const db = require('../../config/db');
const settingsService = require('../settings/settings.service');
const logger = require('../../utils/logger');
const { telegramBotToken, telegramChannelId } = require('../../config/env');

/**
 * Telegram Bot API client.
 *
 * Configuration resolves database settings first, then environment variables,
 * so an admin can change the channel at runtime while a fresh deploy still
 * works from env alone. The previous version threw if the DB rows were absent
 * even when the env vars were set.
 */

const CACHE_TTL_MS = 10 * 60 * 1000;
let configCache = { data: null, expiry: 0 };

async function getTelegramConfig() {
    if (configCache.data && Date.now() < configCache.expiry) {
        return configCache.data;
    }

    const stored = await settingsService.getRawSettings([
        'TELEGRAM_BOT_TOKEN',
        'TELEGRAM_CHANNEL_ID',
    ]);

    const config = {
        botToken: stored.TELEGRAM_BOT_TOKEN || telegramBotToken,
        channelId: stored.TELEGRAM_CHANNEL_ID || telegramChannelId,
    };

    if (!config.botToken || !config.channelId) {
        const error = new Error(
            'Telegram is not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID.'
        );
        error.code = 'TELEGRAM_NOT_CONFIGURED';
        error.status = 503;
        throw error;
    }

    configCache = { data: config, expiry: Date.now() + CACHE_TTL_MS };
    return config;
}

exports.invalidateConfigCache = () => {
    configCache = { data: null, expiry: 0 };
};

/** POST to the Bot API, unwrapping Telegram's {ok, result} envelope. */
async function callTelegram(method, payload) {
    const { botToken } = await getTelegramConfig();
    try {
        const response = await axios.post(
            `https://api.telegram.org/bot${botToken}/${method}`,
            payload,
            { timeout: 10_000 }
        );
        if (!response.data?.ok) {
            throw new Error(response.data?.description || `Telegram ${method} failed`);
        }
        return response.data.result;
    } catch (error) {
        // Never let the bot token reach a log line via the request URL.
        const description = error.response?.data?.description || error.message;
        logger.error(`Telegram ${method} failed`, { description });
        const wrapped = new Error(`Telegram ${method} failed: ${description}`);
        wrapped.code = 'TELEGRAM_API_ERROR';
        throw wrapped;
    }
}

const INVITE_TTL_SECONDS = 24 * 60 * 60;

exports.generateInviteLink = async (userId) => {
    const { channelId } = await getTelegramConfig();
    const expiresAtUnix = Math.floor(Date.now() / 1000) + INVITE_TTL_SECONDS;

    const result = await callTelegram('createChatInviteLink', {
        chat_id: channelId,
        member_limit: 1,
        expire_date: expiresAtUnix,
    });

    const inviteLink = result.invite_link;

    // telegram_access.user_id is UNIQUE, so this upsert is now genuinely
    // idempotent — previously no such constraint existed and the ON CONFLICT
    // target did not match any index.
    await db.query(
        `INSERT INTO telegram_access (user_id, status, invite_link, expires_at)
         VALUES ($1, 'invited', $2, to_timestamp($3))
         ON CONFLICT (user_id) DO UPDATE
            SET status      = 'invited',
                invite_link = EXCLUDED.invite_link,
                expires_at  = EXCLUDED.expires_at,
                is_active   = TRUE`,
        [userId, inviteLink, expiresAtUnix]
    );

    return inviteLink;
};

/**
 * Remove a user from the channel.
 *
 * Errors propagate. The previous implementation swallowed them, so a failed
 * removal looked like a success and an expired subscriber silently kept access.
 */
exports.revokeAccess = async (telegramUserId) => {
    const { channelId } = await getTelegramConfig();

    // Ban then immediately unban: this kicks the member while still allowing
    // them to rejoin later if they renew. A plain ban would lock them out.
    await callTelegram('banChatMember', {
        chat_id: channelId,
        user_id: telegramUserId,
        until_date: Math.floor(Date.now() / 1000) + 35,
    });
    await callTelegram('unbanChatMember', {
        chat_id: channelId,
        user_id: telegramUserId,
        only_if_banned: true,
    });

    await db.query(
        `UPDATE telegram_access
            SET status = 'revoked', is_active = FALSE
          WHERE telegram_user_id = $1`,
        [telegramUserId]
    );

    logger.info('Revoked Telegram access', { telegramUserId });
};

exports.sendMessage = async (chatId, text) => {
    try {
        await callTelegram('sendMessage', { chat_id: chatId, text });
    } catch (error) {
        // Notifications are best-effort: a user who blocked the bot must not
        // fail the surrounding business operation.
        logger.warn('Telegram notification not delivered', { chatId, error: error.message });
    }
};

exports.approveJoinRequest = async (chatId, userId) => {
    await callTelegram('approveChatJoinRequest', { chat_id: chatId, user_id: userId });
    logger.info('Approved Telegram join request', { userId });
};

exports.declineJoinRequest = async (chatId, userId) => {
    try {
        await callTelegram('declineChatJoinRequest', { chat_id: chatId, user_id: userId });
    } catch (error) {
        logger.warn('Could not decline join request', { userId, error: error.message });
    }
};

exports.kickMember = (chatId, userId) => exports.revokeAccess(userId);

exports.getTelegramConfig = getTelegramConfig;
