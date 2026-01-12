const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function run() {
    const email = `test_repro_${Date.now()}@example.com`;
    const password = 'password123';

    console.log("Attempt 1: auth.admin.createUser");
    const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: 'Repro User' }
    });

    if (error) {
        console.error("Error in auth.admin.createUser:", error);
    } else {
        console.log("Success auth.admin.createUser:", data.user.id);
        // Clean up
        await supabase.auth.admin.deleteUser(data.user.id);
    }

    console.log("\nAttempt 2: Insert into public.users with password (EXPECT FAILURE)");
    const { error: insertError } = await supabase.from('users').insert({
        email: `fail_${Date.now()}@example.com`,
        password: 'password123' // This should trigger PGRST204
    });

    if (insertError) {
        console.error("Error in public.users insert:", insertError);
    }
}

run();
