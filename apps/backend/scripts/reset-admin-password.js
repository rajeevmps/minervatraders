const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const ADMIN_EMAIL = 'admin@minervatraders.com';
const NEW_PASSWORD = 'password';

async function resetAdmin() {
    console.log(`Attempting to reset/create admin user: ${ADMIN_EMAIL}`);

    try {
        // 1. Check if user exists in Auth
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) throw listError;

        const existingUser = users.find(u => u.email === ADMIN_EMAIL);

        let userId;

        if (existingUser) {
            console.log('User exists. Updating password...');
            const { data, error } = await supabase.auth.admin.updateUserById(
                existingUser.id,
                { password: NEW_PASSWORD, email_confirm: true }
            );
            if (error) throw error;
            userId = existingUser.id;
            console.log('Password updated successfully.');
        } else {
            console.log('User does not exist. Creating new admin user...');
            const { data, error } = await supabase.auth.admin.createUser({
                email: ADMIN_EMAIL,
                password: NEW_PASSWORD,
                email_confirm: true,
                user_metadata: { full_name: 'System Admin' }
            });
            if (error) throw error;
            userId = data.user.id;
            console.log('Admin user created successfully.');
        }

        // 2. Ensure entry in public.admins
        console.log('Verifying public.admins entry...');
        const { data: adminRecord, error: adminCheckError } = await supabase
            .from('admins')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (!adminRecord) {
            console.log('Adding user to admins table...');
            const { error: insertError } = await supabase
                .from('admins')
                .insert([{ user_id: userId }]);

            if (insertError) {
                console.error('Error adding to admins table:', insertError);
            } else {
                console.log('User added to admins table.');
            }
        } else {
            console.log('User is already in admins table.');
        }

        // 3. Ensure role is 'admin' in public.users
        console.log('Updating public.users role...');
        const { error: updateError } = await supabase
            .from('users')
            .update({ role: 'admin' })
            .eq('id', userId);

        if (updateError) {
            console.error('Error updating public user role:', updateError);
        } else {
            console.log('Public user role confirmed as admin.');
        }


        console.log('------------------------------------------------');
        console.log(`Admin Setup Complete!`);
        console.log(`Email: ${ADMIN_EMAIL}`);
        console.log(`Password: ${NEW_PASSWORD}`);
        console.log('------------------------------------------------');

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

resetAdmin();
