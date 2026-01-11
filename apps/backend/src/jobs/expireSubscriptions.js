const cron = require('node-cron');
const TelegramService = require('../modules/telegram/telegram.service');
const { supabase } = require('../config/db');

// Run every day at midnight
cron.schedule('0 0 * * *', async () => {
    console.log('Running expireSubscriptions job...');
    try {
        const now = new Date().toISOString();

        // 1. Find active subscriptions that have passed their end date
        const { data: expiredSubs, error } = await supabase
            .from('user_subscriptions')
            .select('id, user_id')
            .eq('status', 'active')
            .lt('end_date', now);

        if (error) throw error;

        if (expiredSubs && expiredSubs.length > 0) {
            console.log(`Found ${expiredSubs.length} expired subscriptions.`);

            for (const sub of expiredSubs) {
                // Update subscription status
                const { error: updateError } = await supabase
                    .from('user_subscriptions')
                    .update({ status: 'expired' })
                    .eq('id', sub.id);

                if (updateError) console.error(`Failed to expire sub ${sub.id}:`, updateError);

                // Find Telegram User ID to revoke access
                const { data: tgAccess } = await supabase
                    .from('telegram_access')
                    .select('telegram_user_id')
                    .eq('user_id', sub.user_id)
                    .single();

                if (tgAccess && tgAccess.telegram_user_id) {
                    await TelegramService.revokeAccess(tgAccess.telegram_user_id);
                    console.log(`Revoked Telegram access for User ${sub.user_id} (TG: ${tgAccess.telegram_user_id})`);
                }
            }
        } else {
            console.log('No expired subscriptions found.');
        }

        console.log('expireSubscriptions job completed.');
    } catch (error) {
        console.error('Error in expireSubscriptions job:', error);
    }
});
