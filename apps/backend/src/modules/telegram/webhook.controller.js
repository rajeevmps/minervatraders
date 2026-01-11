const telegramService = require('./telegram.service');
const { supabase } = require('../../config/db');
const subscriptionService = require('../subscription/subscription.service');

// Handle incoming Telegram updates
exports.handleTelegramWebhook = async (req, res) => {
    try {
        const update = req.body;
        console.log('Telegram Webhook:', JSON.stringify(update, null, 2));

        if (update.message && update.message.text && update.message.text.startsWith('/start')) {
            await handleStartCommand(update.message);
        } else if (update.chat_join_request) {
            await handleJoinRequest(update.chat_join_request);
        }

        res.status(200).send('ok');
    } catch (error) {
        console.error('Webhook Error:', error);
        res.status(200).send('ok'); // Always standard 200 to Telegram to stop retries
    }
};

// 1. Identity Linking: /start <UUID>
const handleStartCommand = async (message) => {
    const text = message.text;
    const telegramUserId = message.from.id.toString();
    const telegramUsername = message.from.username;
    const chatId = message.chat.id;

    // Extract UUID from "/start <UUID>"
    const parts = text.split(' ');
    if (parts.length !== 2) {
        return telegramService.sendMessage(chatId, 'Please use the "Connect Telegram" button from your dashboard to start.');
    }

    const userId = parts[1];

    // Validate UUID format (basic check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
        return telegramService.sendMessage(chatId, 'Invalid connection link.');
    }

    // Verify user exists
    const { data: user, error } = await supabase.from('users').select('id').eq('id', userId).single();
    if (error || !user) {
        return telegramService.sendMessage(chatId, 'User not found. Please verify your account.');
    }

    // Link Account in DB
    const { error: upsertError } = await supabase
        .from('telegram_access')
        .upsert({
            user_id: userId,
            telegram_user_id: telegramUserId,
            telegram_username: telegramUsername,
            is_active: true
        }, { onConflict: 'user_id' });

    if (upsertError) {
        console.error('Link Error:', upsertError);
        return telegramService.sendMessage(chatId, 'Failed to link account. Please try again.');
    }

    await telegramService.sendMessage(chatId, '✅ Account Linked! You can now request to join the private channel.');
};

// 2. Join Request Approval
const handleJoinRequest = async (request) => {
    const telegramUserId = request.from.id.toString();
    const chatId = request.chat.id;

    // Find internal user ID from Telegram ID
    const { data: accessRecord } = await supabase
        .from('telegram_access')
        .select('user_id')
        .eq('telegram_user_id', telegramUserId)
        .single();

    if (!accessRecord) {
        // Unknown user
        await telegramService.declineJoinRequest(chatId, telegramUserId);
        await telegramService.sendMessage(telegramUserId, '❌ You are not linked. Please go to your dashboard and click "Connect Telegram" first.');
        return;
    }

    // Check active subscription
    try {
        const sub = await subscriptionService.getActiveSubscription(accessRecord.user_id);

        if (sub && sub.status === 'active') {
            await telegramService.approveJoinRequest(chatId, telegramUserId);
            await telegramService.sendMessage(telegramUserId, '🎉 Request Approved! Welcome to the premium channel.');

            // Mark as joined in DB (optional, but good for tracking)
            await supabase.from('telegram_access').update({ joined_at: new Date() }).eq('telegram_user_id', telegramUserId);
        } else {
            await telegramService.declineJoinRequest(chatId, telegramUserId);
            await telegramService.sendMessage(telegramUserId, '⚠️ Your subscription is not active. Please subscribe to join.');
        }
    } catch (err) {
        console.error('Sub check error:', err);
        // Fail safe: verify sub existence
        if (err.message === 'Plan not found' || err.code === 'PGRST116') { // not found
            await telegramService.declineJoinRequest(chatId, telegramUserId);
            await telegramService.sendMessage(telegramUserId, '⚠️ No active subscription found.');
        }
    }
};
