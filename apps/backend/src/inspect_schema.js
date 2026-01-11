require('dotenv').config();
const { supabase } = require('./config/db');

async function inspect() {
    console.log('Inspecting telegram_access table...');
    // We can't easily query information_schema with supabase-js unless we have direct SQL access or a stored procedure.
    // However, we can try to select * limit 1 and look at the keys of the returned object (if any rows exist), 
    // OR we can try to RPC if allowed.
    // A simpler way for this environment: Just run the ALTER TABLE command. If column exists, we can use IF NOT EXISTS.
    // But to "check", let's try to select the specific column and catch error.

    const { data, error } = await supabase
        .from('telegram_access')
        .select('telegram_username')
        .limit(1);

    if (error) {
        console.error('Column Check Error:', error.message);
    } else {
        console.log('Column exists. Data:', data);
    }
}

inspect();
