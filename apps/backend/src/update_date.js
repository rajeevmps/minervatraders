require('dotenv').config();
const { supabase } = require('./config/db');

async function update() {
    console.log('Updating subscription date to TOMORROW...');

    // Get the ID first
    const { data: sub } = await supabase
        .from('user_subscriptions')
        .select('id')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (!sub) {
        console.error('No active subscription found.');
        return;
    }

    // Set end_date to NOW + 25 hours (just to be safe for "1 day" logic which checks ranges)
    // Actually our logic was: targetDate = today + 1. 24-48 hours window.
    // Let's set it to exactly 24 hours from now.
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(tomorrow.getHours() + 1); // +1 hour padding

    const { error } = await supabase
        .from('user_subscriptions')
        .update({ end_date: tomorrow.toISOString() })
        .eq('id', sub.id);

    if (error) {
        console.error('Update Error:', error);
    } else {
        console.log('Update Success! New End Date:', tomorrow.toISOString());
    }
}

update();
