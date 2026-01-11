require('dotenv').config();
const { supabase } = require('./config/db');

async function check() {
    console.log('Checking latest active subscription...');
    const { data, error } = await supabase
        .from('user_subscriptions')
        .select(`
            id, 
            status, 
            end_date, 
            user_id,
            users (
                email,
                telegram_access (
                    telegram_user_id,
                    telegram_username,
                    is_active
                )
            )
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Result:', JSON.stringify(data, null, 2));
    }
}

check();
