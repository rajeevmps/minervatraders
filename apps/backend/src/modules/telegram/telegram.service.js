const axios = require('axios');
const { telegramBotToken } = require('../../config/env');
const { supabase } = require('../../config/db');

const TELEGRAM_API_URL = `https://api.telegram.org/bot${telegramBotToken}`;

// Helper to send message
const sendMessage = async (chatId, text) => {
    try {
        await axios.post(`${TELEGRAM_API_URL}/sendMessage`, { chat_id: chatId, text });
        console.log(`Sending message to ${chatId}: ${text}`);
    } catch (error) {
        console.error('Telegram Send Error:', error.message);
    }
};

exports.generateInviteLink = async (userId) => {
    const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
    const EXPIRE_MINUTES = 24 * 60; // 24 hours expiry
    const expireTimestamp = Math.floor(Date.now() / 1000) + (EXPIRE_MINUTES * 60);

    try {
        const response = await axios.post(`${TELEGRAM_API_URL}/createChatInviteLink`, {
            chat_id: CHANNEL_ID,
            member_limit: 1, // One use only
            expire_date: expireTimestamp, // Expire in 10 minutes
        });

        const inviteLink = response.data.result.invite_link;

        // 2. Log access grant to DB with expiry
        await supabase.from('telegram_access').insert([{
            user_id: userId,
            status: 'invited',
            invite_link: inviteLink,
            expires_at: new Date(expireTimestamp * 1000).toISOString()
        }]);

        return inviteLink;

    } catch (error) {
        console.error('Telegram Invite Gen Error:', error.response?.data || error.message);
        throw new Error('Failed to generate Telegram invite');
    }
};

exports.revokeAccess = async (telegramUserId) => {
    const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
    try {
        await axios.post(`${TELEGRAM_API_URL}/banChatMember`, {
            chat_id: CHANNEL_ID,
            user_id: telegramUserId,
            until_date: Math.floor(Date.now() / 1000) + 60 // Ban for 1 min just to kick, or simple kickChatMember
        });

        // Update DB
        await supabase.from('telegram_access')
            .update({ status: 'revoked' })
            .eq('telegram_user_id', telegramUserId);

    } catch (error) {
        console.error('Telegram Revoke Error:', error.message);
    }
};

exports.sendMessage = sendMessage;

exports.approveJoinRequest = async (chatId, userId) => {
    try {
        await axios.post(`${TELEGRAM_API_URL}/approveChatJoinRequest`, {
            chat_id: chatId,
            user_id: userId
        });
        console.log(`Approved join request for ${userId}`);
    } catch (error) {
        console.error('Approve Join Error:', error.message);
        throw error;
    }
};

exports.declineJoinRequest = async (chatId, userId) => {
    try {
        await axios.post(`${TELEGRAM_API_URL}/declineChatJoinRequest`, {
            chat_id: chatId,
            user_id: userId
        });
        console.log(`Declined join request for ${userId}`);
    } catch (error) {
        console.error('Decline Join Error:', error.message);
        // Don't throw, just log
    }
};

exports.kickMember = async (chatId, userId) => {
    try {
        // Ban (kick)
        await axios.post(`${TELEGRAM_API_URL}/banChatMember`, {
            chat_id: chatId,
            user_id: userId,
            until_date: Math.floor(Date.now() / 1000) + 35 // Ban for 35 seconds (minimum allowed is 30s) just to kick them out
        });

        // Unban immediately so they can request to join again later if they renew
        await axios.post(`${TELEGRAM_API_URL}/unbanChatMember`, {
            chat_id: chatId,
            user_id: userId
        });

        console.log(`Kicked user ${userId} from ${chatId}`);
    } catch (error) {
        console.error('Kick Member Error:', error.message);
    }
};
