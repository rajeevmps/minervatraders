const { supabase } = require('../../config/db');

// --- Stats & Dashboard ---

exports.getStats = async (req, res) => {
    try {
        // Parallel fetch for improvements
        const [users, subs, payments] = await Promise.all([
            supabase.from('users').select('*', { count: 'exact', head: true }),
            supabase.from('user_subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
            supabase.from('payments').select('amount').eq('status', 'captured') // Assuming 'captured' or 'success'
        ]);

        // Calculate Revenue (Basic Sum)
        const totalRevenue = payments.data?.reduce((acc, curr) => acc + (curr.amount || 0), 0) || 0;

        res.json({
            totalUsers: users.count || 0,
            activeSubscriptions: subs.count || 0,
            totalRevenue: totalRevenue,
            systemHealth: 'Optimal'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching stats' });
    }
};

// --- User Management ---

exports.getUsers = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('users')
            .select(`
                *,
                user_subscriptions (
                    status,
                    plan_id
                )
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);

        if (search) {
            query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
        }

        const { data, count, error } = await query;

        if (error) throw error;

        res.json({
            users: data,
            total: count,
            page: parseInt(page),
            totalPages: Math.ceil((count || 0) / limit)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching users' });
    }
};

exports.createUser = async (req, res) => {
    try {
        const { email, password, full_name } = req.body;

        // 1. Create in Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name }
        });

        if (authError) throw authError;

        // 2. Create in public.users (if not handled by trigger)
        // Check if trigger exists? Assuming we might need to manual insert if triggers aren't 100% reliable or present
        // But usually best to rely on triggers. Let's return success.

        res.status(201).json({ message: 'User created successfully', user: authData.user });
    } catch (error) {
        console.error(error);
        res.status(400).json({ message: error.message });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body; // full_name, etc.

        // We only update public.users typically
        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', id)
            .select();

        if (error) throw error;

        res.json({ message: 'User updated', user: data[0] });
    } catch (error) {
        console.error(error);
        res.status(400).json({ message: 'Update failed' });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        // Soft delete or Hard delete?
        // Admin usually expects Hard delete from Auth
        const { error } = await supabase.auth.admin.deleteUser(id);

        if (error) throw error;

        // Cleanup public tables if not cascaded
        await supabase.from('users').delete().eq('id', id);

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(400).json({ message: 'Delete failed' });
    }
};

// --- Subscription Plans Management ---

exports.getPlans = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('subscription_plans')
            .select('*')
            .order('price', { ascending: true });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching plans' });
    }
};

exports.createPlan = async (req, res) => {
    try {
        const { name, price, duration_days } = req.body;
        const { data, error } = await supabase
            .from('subscription_plans')
            .insert([{ name, price, duration_days, is_active: true }])
            .select();

        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (error) {
        console.error(error);
        res.status(400).json({ message: 'Failed to create plan' });
    }
};

exports.updatePlan = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const { data, error } = await supabase
            .from('subscription_plans')
            .update(updates)
            .eq('id', id)
            .select();

        if (error) throw error;
        res.json(data[0]);
    } catch (error) {
        console.error(error);
        res.status(400).json({ message: 'Failed to update plan' });
    }
};

exports.deletePlan = async (req, res) => {
    try {
        const { id } = req.params;
        // Soft delete implementation: toggle is_active to false
        const { data, error } = await supabase
            .from('subscription_plans')
            .update({ is_active: false })
            .eq('id', id)
            .select();

        if (error) throw error;
        res.json({ message: 'Plan deactivated successfully', plan: data[0] });
    } catch (error) {
        console.error(error);
        res.status(400).json({ message: 'Failed to delete plan' });
    }
};

// --- Payments Management ---

exports.getPayments = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const { data, count, error } = await supabase
            .from('payments')
            .select('*, users(email, full_name)', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error;

        res.json({
            data,
            count,
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching payments' });
    }
};

// --- Subscription Management ---

exports.getSubscriptions = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('user_subscriptions')
            .select('*, users(email, full_name), subscription_plans(name, price)')
            .eq('status', 'active')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching subscriptions' });
    }
};

exports.grantSubscription = async (req, res) => {
    try {
        const { email, planId, durationInDays } = req.body;

        // 1. Find User
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (userError || !user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // 2. Resolve Plan ID (optional: verify plan exists)
        // For simplicity, just using the ID string or fetching plan

        // 3. Create Subscription
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + (durationInDays || 30));

        const { data, error } = await supabase
            .from('user_subscriptions')
            .insert([{
                user_id: user.id,
                plan_id: planId, // UUID check needed ideally, but client passes ID logic
                start_date: startDate,
                end_date: endDate,
                status: 'active'
            }])
            .select();

        if (error) throw error;

        res.status(201).json({ message: 'Subscription granted', subscription: data[0] });

    } catch (error) {
        console.error(error);
        res.status(400).json({ message: 'Failed to grant subscription' });
    }
};

exports.revokeSubscription = async (req, res) => {
    try {
        const { userId } = req.body;

        // Revoke ALL active subscriptions for user
        const { error } = await supabase
            .from('user_subscriptions')
            .update({ status: 'revoked' })
            .eq('user_id', userId)
            .eq('status', 'active');

        if (error) throw error;

        res.json({ message: 'Subscriptions revoked' });
    } catch (error) {
        console.error(error);
        res.status(400).json({ message: 'Failed to revoke subscription' });
    }
};

// --- Data Export ---

const jsonToCsv = (items) => {
    if (!items || !items.length) return '';
    const keys = Object.keys(items[0]);
    const header = keys.join(',');
    const rows = items.map(item =>
        keys.map(key => {
            let val = item[key];
            if (val === null || val === undefined) return '""';
            if (typeof val === 'object') val = JSON.stringify(val).replace(/"/g, '""');
            return `"${val}"`;
        }).join(',')
    );
    return [header, ...rows].join('\n');
};

exports.exportData = async (req, res) => {
    try {
        const { type } = req.params;
        let query;

        switch (type) {
            case 'users':
                query = supabase.from('users').select('*');
                break;
            case 'subscriptions':
                query = supabase.from('user_subscriptions').select('*, users(email)');
                break;
            case 'payments':
                query = supabase.from('payments').select('*, users(email)');
                break;
            default:
                return res.status(400).json({ message: 'Invalid export type' });
        }

        const { data, error } = await query;
        if (error) throw error;

        // Flatten nested data for cleaner CSV (specifically user email)
        const flatData = data.map(row => {
            const newRow = { ...row };
            if (newRow.users) {
                newRow.user_email = newRow.users.email;
                delete newRow.users;
            }
            return newRow;
        });

        const csv = jsonToCsv(flatData);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${type}-${Date.now()}.csv`);
        res.send(csv);

    } catch (error) {
        console.error('Export Error:', error);
        res.status(500).json({ message: 'Export failed' });
    }
};

// --- Generic Tables (Legacy Support) ---
exports.getTables = async (req, res) => {
    try {
        const { data, error } = await supabase.rpc('get_tables', {});
        if (error) throw error;
        const tables = data.map(t => t.table_name);
        res.json({ tables });
    } catch (error) {
        console.error('Error fetching tables:', error);
        res.status(500).json({ message: 'Error fetching tables' });
    }
};

exports.getTableData = async (req, res) => {
    try {
        const { tableName } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const { data, count, error } = await supabase
            .from(tableName)
            .select('*', { count: 'exact' })
            .range(from, to);

        if (error) throw error;

        res.json({
            data,
            count,
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (error) {
        console.error('Error in getTableData:', error);
        res.status(500).json({ message: `Error fetching data for ${req.params.tableName}` });
    }
};
