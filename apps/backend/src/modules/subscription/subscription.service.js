const { supabase } = require('../../config/db');

exports.createSubscription = async (userId, planId, paymentId) => {
    // 1. Get Plan Details
    const { data: plan, error: planError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', planId)
        .single();

    if (planError || !plan) throw new Error('Plan not found');

    // 2. Calculate Dates
    const startDate = new Date();
    const endDate = new Date();

    if (plan.duration_days) {
        endDate.setDate(endDate.getDate() + plan.duration_days);
    } else {
        // Fallback or error
        endDate.setMonth(endDate.getMonth() + 1);
    }

    // 3. Deactivate old active subscriptions (Prevent duplicate active plans)
    await supabase
        .from('user_subscriptions')
        .update({ status: 'expired' })
        .eq('user_id', userId)
        .eq('status', 'active');

    // 4. Create New Subscription
    const { data: sub, error: subError } = await supabase
        .from('user_subscriptions')
        .insert([{
            user_id: userId,
            plan_id: planId,
            start_date: startDate,
            end_date: endDate,
            status: 'active',
            order_id: paymentId // This is actually the internal Order UUID
        }])
        .select()
        .single();

    if (subError) throw subError;
    return sub;
};

exports.getActiveSubscription = async (userId) => {
    const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*, plan:subscription_plans(*)')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gte('end_date', new Date().toISOString()) // Double check expiry
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
};

exports.getAllPlans = async () => {
    const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });

    if (error) throw error;
    return data;
};
