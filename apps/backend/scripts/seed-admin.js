const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Standard: Fail fast if config is missing
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Critical Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    console.error('   Please check apps/backend/.env');
    process.exit(1);
}

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SEED_ADMIN_EMAIL = 'admin@minervatraders.com';
const SEED_ADMIN_PASSWORD = 'MinervaAdmin123!';

const seedAdmin = async () => {
    console.log(`\n🚀 Starting Database Seed: Admin User...`);
    console.log(`   Target: ${SEED_ADMIN_EMAIL}`);

    try {
        // 1. Check if user exists (Idempotency)
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) throw listError;

        const existingUser = users.find(u => u.email === SEED_ADMIN_EMAIL);
        let userId;

        if (existingUser) {
            console.log(`   ℹ️  User exists (ID: ${existingUser.id}). Updating credentials...`);
            userId = existingUser.id;

            // Standard: Update credentials to known state for dev/recovery
            const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
                password: SEED_ADMIN_PASSWORD,
                user_metadata: { full_name: 'Minerva Admin', role: 'admin' },
                email_confirm: true
            });
            if (updateError) throw updateError;
            console.log(`   ✅ Credentials updated.`);

        } else {
            console.log(`   🆕 User not found. Creating new admin identity...`);
            const { data: newData, error: createError } = await supabase.auth.admin.createUser({
                email: SEED_ADMIN_EMAIL,
                password: SEED_ADMIN_PASSWORD,
                email_confirm: true,
                user_metadata: { full_name: 'Minerva Admin', role: 'admin' }
            });
            if (createError) throw createError;
            userId = newData.user.id;
            console.log(`   ✅ Identity created (ID: ${userId}).`);
        }

        // 2. Ensure Role/Permissions (RBAC)
        // Standard: Explicitly add to admins table/role table
        console.log(`   👑 Ensuring Admin Role assignment...`);
        const { error: roleError } = await supabase
            .from('admins')
            .upsert([{ user_id: userId }], { onConflict: 'user_id' });

        if (roleError) throw roleError;

        // 3. Sync to public.users (if using separate profile table)
        const { error: profileError } = await supabase
            .from('users')
            .upsert({
                id: userId,
                email: SEED_ADMIN_EMAIL,
                full_name: 'Minerva Admin',
                role: 'admin'
            }, { onConflict: 'id' });

        if (profileError) console.warn(`   ⚠️  Profile Sync Warning: ${profileError.message}`);

        console.log(`\n✅ SEED COMPLETE. System is ready.`);
        console.log(`---------------------------------------------------`);
        console.log(`📧 Email:    ${SEED_ADMIN_EMAIL}`);
        console.log(`🔑 Password: ${SEED_ADMIN_PASSWORD}`);
        console.log(`---------------------------------------------------\n`);

    } catch (error) {
        console.error(`\n❌ SEED FAILED: ${error.message}`);
        process.exit(1);
    }
};

seedAdmin();
