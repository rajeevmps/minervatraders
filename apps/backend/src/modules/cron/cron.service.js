const cron = require('node-cron');
const { supabase } = require('../../config/db');
const telegramService = require('../telegram/telegram.service');

const initCronJobs = () => {
    // Run twice a day at midnight and noon: '0 0,12 * * *'
    cron.schedule('0 0,12 * * *', async () => {
        console.log('--- Running Subscription Cleanup & Reminders (Twice Daily) ---');
        await processExpiredSubscriptions();
        await processRenewalReminders();
    });
    console.log('--- Cron Jobs Initialized ---');
};


const processRenewalReminders = async () => {
    try {
        const today = new Date();
        const targets = [1, 3]; // Days before expiry to remind

        for (const days of targets) {
            const targetDate = new Date(today);
            targetDate.setDate(today.getDate() + days);

            // Format to YYYY-MM-DD for simple string comparison or use range
            // Here assuming we compare by day. 
            // A better way for DB: start of day <= end_date < end of day.
            // For simplicity/robustness, let's grab sub's ending roughly on this day.
            const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0)).toISOString();
            const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999)).toISOString();

            const { data: subs, error } = await supabase
                .from('user_subscriptions')
                .select(`
                    id, 
                    end_date,
                    users ( telegram_access ( telegram_user_id ) )
                `)
                .eq('status', 'active')
                .gte('end_date', startOfDay)
                .lte('end_date', endOfDay);

            if (!error && subs && subs.length > 0) {
                console.log(`Found ${subs.length} users expiring in ${days} days.`);
                for (const sub of subs) {
                    const access = sub.users?.telegram_access;
                    const telegramData = Array.isArray(access) ? access[0] : access;

                    if (telegramData?.telegram_user_id) {
                        const msg = `⚠️ **Reminder:** Your subscription expires in ${days} day${days > 1 ? 's' : ''}! \n\nPlease renew via your dashboard to maintain access to the channel.`;
                        await telegramService.sendMessage(telegramData.telegram_user_id, msg);
                    }
                }
            }
        }
    } catch (err) {
        console.error('Reminder Job Error:', err);
    }
};

const processExpiredSubscriptions = async () => {
    try {
        const now = new Date().toISOString();

        // 1. Find ACTIVE subscriptions that have EXPIRED (end_date < now)
        const { data: expiredSubs, error } = await supabase
            .from('user_subscriptions')
            .select(`
                id, 
                user_id, 
                users (
                    telegram_access (
                        telegram_user_id
                    )
                )
            `)
            .eq('status', 'active')
            .lt('end_date', now);

        if (error) throw error;

        if (!expiredSubs || expiredSubs.length === 0) {
            console.log('No expired subscriptions found.');
            return;
        }

        console.log(`Found ${expiredSubs.length} expired subscriptions. Processing...`);

        const PROCESSED_STATUS = 'expired';
        const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;

        for (const sub of expiredSubs) {
            const userId = sub.user_id;

            // Mark as expired in DB
            await supabase
                .from('user_subscriptions')
                .update({ status: PROCESSED_STATUS })
                .eq('id', sub.id);

            // Access nested telegram info (Supabase returns array for 1:many, or object if single? using safe check)
            const access = sub.users?.telegram_access;
            // It could be an array if relation is one-to-many
            const telegramData = Array.isArray(access) ? access[0] : access;

            if (telegramData && telegramData.telegram_user_id) {
                // KICK from Telegram
                await telegramService.kickMember(CHANNEL_ID, telegramData.telegram_user_id);

                // Update Access Status (optional)
                await supabase.from('telegram_access')
                    .update({ is_active: false })
                    .eq('telegram_user_id', telegramData.telegram_user_id);
            }
        }

    } catch (err) {
        console.error('Cron Job Error:', err);
    }
};

module.exports = {
    initCronJobs
};
