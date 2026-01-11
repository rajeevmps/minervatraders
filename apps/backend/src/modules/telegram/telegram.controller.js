const telegramService = require('./telegram.service');
const { supabase } = require('../../config/db');

exports.getInviteLink = async (req, res, next) => {
    try {
        const userId = req.user.id;

        // 1. Check if user has active subscription
        const { data: sub } = await supabase
            .from('user_subscriptions')
            .select('status')
            .eq('user_id', userId)
            .eq('status', 'active')
            .single();

        if (!sub) {
            return res.status(403).json({ message: 'Active subscription required to join Telegram channel.' });
        }

        // 2. Check if link already generated
        const { data: existingAccess } = await supabase
            .from('telegram_access')
            .select('invite_link')
            .eq('user_id', userId)
            .single();

        if (existingAccess && existingAccess.invite_link) {
            return res.status(200).json({ inviteLink: existingAccess.invite_link });
        }

        // 3. Generate new link
        const inviteLink = await telegramService.generateInviteLink(userId);
        res.status(200).json({ inviteLink });

    } catch (error) {
        next(error);
    }
};
