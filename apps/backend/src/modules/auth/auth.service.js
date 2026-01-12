const { supabase } = require('../../config/db');

/**
 * Service to handle user synchronization or extended profile management.
 * Core auth is handled by Supabase.
 */
exports.syncUser = async (userData) => {
    const { id, email, fullName, role } = userData;

    // Attempt to upsert user profile based on data from frontend/Supabase
    const { data, error } = await supabase.from('users').upsert({
        id: id,
        email: email,
        full_name: fullName,
        role: role || 'user',
        updated_at: new Date()
    }, { onConflict: 'id' }).select().single();

    if (error) {
        console.error('Error syncing user:', error);
        throw error;
    }

    return data;
};
