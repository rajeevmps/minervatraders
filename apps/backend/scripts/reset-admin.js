const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const resetAdmin = async () => {
    const email = 'admin@minervatraders.com';
    const password = 'MinervaAdmin123!';

    console.log(`\n🔄 Resetting account for: ${email}`);

    try {
        // 1. List valid users to find ID (since getUserByEmail is deprecated/restricted sometimes)
        // Or just try to delete if we stored ID somewhere, but listing is safer.
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

        if (listError) throw listError;

        const existingUser = users.find(u => u.email === email);

        if (existingUser) {
            console.log(`   🗑️  Deleting existing user (ID: ${existingUser.id})...`);
            const { error: delError } = await supabase.auth.admin.deleteUser(existingUser.id);
            if (delError) throw delError;
        }

        // 2. Create new user with known password
        console.log('   🆕 Creating new user account...');
        const { data: newData, error: createError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: 'System Admin' }
        });

        if (createError) throw createError;
        const newUserId = newData.user.id;
        console.log(`   ✅ User created (ID: ${newUserId})`);

        // 3. Promote to Admin Table
        console.log('   👑 Promoting to Admin...');
        const { error: promoteError } = await supabase
            .from('admins')
            .upsert([{ user_id: newUserId }], { onConflict: 'user_id' });

        if (promoteError) throw promoteError;

        console.log('\n✅ DONE! Setup complete.');
        console.log(`\nLogin Details:`);
        console.log(`Email:    ${email}`);
        console.log(`Password: ${password}`);

    } catch (err) {
        console.error('❌ Error:', err.message);
    }
};

resetAdmin();
