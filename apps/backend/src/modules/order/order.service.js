const { supabase } = require('../../config/db');

exports.getOrders = async (userId) => {
    const { data, error } = await supabase
        .from('orders')
        .select('*, items:order_items(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
};

exports.getOrderById = async (userId, orderId) => {
    const { data, error } = await supabase
        .from('orders')
        .select('*, items:order_items(*)')
        .eq('id', orderId)
        .eq('user_id', userId) // Security
        .single();

    if (error) throw error;
    return data;
};

// Note: Order creation generally happens via Payment flow (Razorpay) or a specific 'checkout' service.
// This service focuses on retrieving order history.
// However, if manual order creation is needed (e.g. valid '0' cost or test), it can be added here.
