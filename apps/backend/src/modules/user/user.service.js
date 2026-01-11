const { supabase } = require('../../config/db');

exports.getUserById = async (userId) => {
    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
        throw error;
    }

    return user;
};
