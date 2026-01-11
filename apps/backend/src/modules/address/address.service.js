const { supabase } = require('../../config/db');

exports.getAddress = async (userId) => {
    const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', userId);

    if (error) throw error;
    return data;
};

exports.addAddress = async (userId, addressData) => {
    const { data, error } = await supabase
        .from('addresses')
        .insert([{ ...addressData, user_id: userId }])
        .select()
        .single();

    if (error) throw error;
    return data;
};

exports.updateAddress = async (userId, addressId, addressData) => {
    const { data, error } = await supabase
        .from('addresses')
        .update(addressData)
        .eq('id', addressId)
        .eq('user_id', userId)
        .select()
        .single();

    if (error) throw error;
    return data;
};

exports.deleteAddress = async (userId, addressId) => {
    const { error } = await supabase
        .from('addresses')
        .delete()
        .eq('id', addressId)
        .eq('user_id', userId);

    if (error) throw error;
    return { message: 'Address removed' };
};
