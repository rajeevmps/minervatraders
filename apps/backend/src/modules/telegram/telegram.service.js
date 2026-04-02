const axios = require('axios');
const { telegramBotToken } = require('../../config/env');
const { supabase } = require('../../config/db');

let configCache = { data: null, expiry: 0 };
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Helper to get Telegram Config with In-Memory Caching
const getTelegramConfig = async () => {
    if (configCache.data && Date.now() < configCache.expiry) {
        return configCache.data;
    }

    const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .in('key', ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHANNEL_ID']);

    if (error) throw error;

    const config = {};
    data.forEach((item) => {
        config[item.key] = item.value;
    });

    if (!config.TELEGRAM_BOT_TOKEN || !config.TELEGRAM_CHANNEL_ID) {
        throw new Error('Telegram configuration missing in system settings');
    }

    configCache.data = config;
    configCache.expiry = Date.now() + CACHE_TTL_MS;

    return config;
};

// Expose a function to invalidate cache if an admin changes settings
exports.invalidateConfigCache = () => {
    configCache.expiry = 0;
};

// Helper to send message
const sendMessage = async (chatId, text) => {
    try {
        const config = await getTelegramConfig();
        const TELEGRAM_API_URL = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}`;

        await axios.post(`${TELEGRAM_API_URL}/sendMessage`, { chat_id: chatId, text });
        console.log(`Sending message to ${chatId}: ${text}`);
    } catch (error) {
        console.error('Telegram Send Error:', error.message);
    }
};

exports.generateInviteLink = async (userId) => {
    const EXPIRE_MINUTES = 24 * 60; // 24 hours expiry
    const expireTimestamp = Math.floor(Date.now() / 1000) + EXPIRE_MINUTES * 60;

    try {
        const config = await getTelegramConfig();
        const TELEGRAM_API_URL = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}`; // Re-defined per request context

        const response = await axios.post(`${TELEGRAM_API_URL}/createChatInviteLink`, {
            chat_id: config.TELEGRAM_CHANNEL_ID,
            member_limit: 1, // One use only
            expire_date: expireTimestamp, // Expire in 10 minutes
        });

        const inviteLink = response.data.result.invite_link;

        // 2. Log access grant to DB with expiry
        const { error: insertError } = await supabase.from('telegram_access').upsert(
            {
                user_id: userId,
                status: 'invited',
                invite_link: inviteLink,
                expires_at: new Date(expireTimestamp * 1000).toISOString(),
            },
            { onConflict: 'user_id' }
        );

        if (insertError) {
            console.error('DB Insert Error:', insertError);
            throw new Error('Failed to save invite link to database');
        }

        return inviteLink;
    } catch (error) {
        console.error('Telegram Invite Gen Error:', error.response?.data || error.message);
        throw new Error('Failed to generate Telegram invite');
    }
};

// Re-defined per request to ensure latest config is used
const getTelegramApiUrl = (token) => `https://api.telegram.org/bot${token}`;

exports.revokeAccess = async (telegramUserId) => {
    try {
        const config = await getTelegramConfig();
        const TELEGRAM_API_URL = getTelegramApiUrl(config.TELEGRAM_BOT_TOKEN);

        await axios.post(`${TELEGRAM_API_URL}/banChatMember`, {
            chat_id: config.TELEGRAM_CHANNEL_ID,
            user_id: telegramUserId,
            until_date: Math.floor(Date.now() / 1000) + 60, // Ban for 1 min just to kick, or simple kickChatMember
        });

        // Update DB
        await supabase
            .from('telegram_access')
            .update({ status: 'revoked' })
            .eq('telegram_user_id', telegramUserId);
    } catch (error) {
        console.error('Telegram Revoke Error:', error.message);
    }
};

exports.sendMessage = sendMessage;

exports.approveJoinRequest = async (chatId, userId) => {
    try {
        const config = await getTelegramConfig();
        const TELEGRAM_API_URL = getTelegramApiUrl(config.TELEGRAM_BOT_TOKEN);

        await axios.post(`${TELEGRAM_API_URL}/approveChatJoinRequest`, {
            chat_id: chatId,
            user_id: userId,
        });
        console.log(`Approved join request for ${userId}`);
    } catch (error) {
        console.error('Approve Join Error:', error.message);
        throw error;
    }
};

exports.declineJoinRequest = async (chatId, userId) => {
    try {
        const config = await getTelegramConfig();
        const TELEGRAM_API_URL = getTelegramApiUrl(config.TELEGRAM_BOT_TOKEN);

        await axios.post(`${TELEGRAM_API_URL}/declineChatJoinRequest`, {
            chat_id: chatId,
            user_id: userId,
        });
        console.log(`Declined join request for ${userId}`);
    } catch (error) {
        console.error('Decline Join Error:', error.message);
        // Don't throw, just log
    }
};

exports.kickMember = async (chatId, userId) => {
    try {
        const config = await getTelegramConfig();
        const TELEGRAM_API_URL = getTelegramApiUrl(config.TELEGRAM_BOT_TOKEN);

        // Ban (kick)
        await axios.post(`${TELEGRAM_API_URL}/banChatMember`, {
            chat_id: chatId,
            user_id: userId,
            until_date: Math.floor(Date.now() / 1000) + 35, // Ban for 35 seconds (minimum allowed is 30s) just to kick them out
        });

        // Unban immediately so they can request to join again later if they renew
        await axios.post(`${TELEGRAM_API_URL}/unbanChatMember`, {
            chat_id: chatId,
            user_id: userId,
        });

        console.log(`Kicked user ${userId} from ${chatId}`);
    } catch (error) {
        console.error('Kick Member Error:', error.message);
    }
};
