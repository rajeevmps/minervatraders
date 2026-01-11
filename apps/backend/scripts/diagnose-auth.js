const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAuth() {
    console.log('🔍 Testing Auth System...');
    const testEmail = `test_${Date.now()}@example.com`;

    try {
        // 1. Try to create a user (simulates sign up)
        const { data, error } = await supabase.auth.admin.createUser({
            email: testEmail,
            password: 'Password123!',
            email_confirm: true,
            user_metadata: { full_name: 'Test User' }
        });

        if (error) {
            console.error('❌ Creation Failed:', error);
            console.log('   Possible Cause: Database Trigger Failure (handle_new_user)');
        } else {
            console.log('✅ User Creation SUCCESS');
            console.log('   User ID:', data.user.id);

            // 2. Cleanup
            await supabase.auth.admin.deleteUser(data.user.id);
            console.log('✅ Cleanup SUCCESS');
        }

    } catch (e) {
        console.error('❌ unexpected error:', e);
    }
}

testAuth();
