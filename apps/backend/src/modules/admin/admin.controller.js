const { supabase } = require('../../config/db');
const { sendResponse } = require('../../utils/responseHelper');

// --- Stats & Dashboard ---

// --- Audit Logging Helper ---
const logAudit = async (userId, action, req) => {
    try {
        await supabase.from('audit_logs').insert([{
            user_id: userId,
            action: action,
            ip_address: req.ip || req.connection.remoteAddress,
            user_agent: req.headers['user-agent']
        }]);
    } catch (err) {
        console.error("Audit Log Error:", err);
    }
};

exports.getAuditLogs = async (req, res) => {
    try {
        const { page = 1, limit = 20, userId } = req.query;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('audit_logs')
            .select('*, users(email, full_name)', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);

        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data, count, error } = await query;

        if (error) throw error;

        return sendResponse(res, 200, true, 'Audit logs fetched', {
            logs: data,
            count,
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (error) {
        return sendResponse(res, 500, false, 'Error fetching audit logs', null, error);
    }
};

// --- Stats & Dashboard ---

exports.getStats = async (req, res) => {
    try {
        const [users, subs, payments, recentLogs] = await Promise.all([
            supabase.from('users').select('*', { count: 'exact', head: true }),
            supabase.from('user_subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
            supabase.from('payments').select('amount').eq('status', 'captured'),
            supabase.from('audit_logs').select('action, details, created_at, users(full_name, email)').order('created_at', { ascending: false }).limit(5)
        ]);

        const totalRevenue = payments.data?.reduce((acc, curr) => acc + (curr.amount || 0), 0) || 0;

        return sendResponse(res, 200, true, 'Stats fetched successfully', {
            totalUsers: users.count || 0,
            activeSubscriptions: subs.count || 0,
            totalRevenue: totalRevenue,
            recentLogs: recentLogs.data || [],
            systemHealth: 'Optimal'
        });
    } catch (error) {
        console.error(error);
        return sendResponse(res, 500, false, 'Error fetching stats', null, error);
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

        return sendResponse(res, 200, true, 'Users fetched successfully', {
            users: data,
            total: count,
            page: parseInt(page),
            totalPages: Math.ceil((count || 0) / limit)
        });
    } catch (error) {
        console.error(error);
        return sendResponse(res, 500, false, 'Error fetching users', null, error);
    }
};

exports.createUser = async (req, res) => {
    try {
        const { email, password, full_name, role } = req.body;

        // 1. Create in Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name }
        });

        if (authError) throw authError;

        // 1.5 Explicitly sync public profile to ensure it exists and has correct role
        // This fixes race conditions where the trigger hasn't fired yet, or sets default 'user' role
        const { error: profileError } = await supabase
            .from('users')
            .upsert({
                id: authData.user.id,
                email: email,
                full_name: full_name,
                role: role || 'user',
            }, { onConflict: 'id' }); // Merge if exists

        if (profileError) {
            console.error("Warning: Public profile sync failed", profileError);
            // We don't throw here to avoid failing the whole request if auth user was created, 
            // but it might cause issues downstream.
        }

        // 2. If 'role' is provided and it's 'admin', add to admins table
        if (role === 'admin') {
            const { error: adminError } = await supabase
                .from('admins')
                .upsert([{ user_id: authData.user.id }], { onConflict: 'user_id', ignoreDuplicates: true });

            if (adminError) {
                console.error(`CRITICAL: Failed to add user ${authData.user.id} to admins table:`, adminError);
                // Throwing here to inform the frontend that while user was created, admin role assignment failed
                throw new Error(`User created but failed to assign Admin role: ${adminError.message}`);
            }
        }

        // Audit
        await logAudit(req.user.sub, `Created User: ${email} (Role: ${role || 'user'})`, req);

        return sendResponse(res, 201, true, 'User created successfully', { user: authData.user });
    } catch (error) {
        console.error(error);
        return sendResponse(res, 400, false, error.message || 'Failed to create user', null, error);
    }
};

exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { password, email, role, ...profileUpdates } = req.body;

        // 1. Update Auth (Password/Email)
        const cleanPassword = password && password.trim() ? password.trim() : undefined;

        if (cleanPassword || email) {
            const authUpdates = {};
            if (cleanPassword) authUpdates.password = cleanPassword;
            if (email) authUpdates.email = email;

            const { error: authError } = await supabase.auth.admin.updateUserById(id, authUpdates);

            if (authError) {
                // Return specific error for weak password to help user
                if (authError.code === 'weak_password') {
                    return sendResponse(res, 400, false, `Password too weak. It must be at least 6 characters and contain both letters and numbers.`);
                }
                throw authError; // Standard handling for other errors
            }
        }

        // 2. Handle Role Update
        if (role) {
            if (role === 'admin') {
                // Add to admins
                const { error: adminError } = await supabase
                    .from('admins')
                    .upsert([{ user_id: id }], { onConflict: 'user_id', ignoreDuplicates: true });
                if (adminError) console.error("Failed to add admin role:", adminError);
            } else {
                // Remove from admins
                const { error: adminError } = await supabase.from('admins').delete().eq('user_id', id);
                if (adminError) console.error("Failed to remove admin role:", adminError);
            }
            // Update role in profile if we store it there (we do)
            profileUpdates.role = role;
        }

        // 3. Update Public Profile (Exclude password!)
        if (Object.keys(profileUpdates).length > 0) {
            const { data, error } = await supabase
                .from('users')
                .update(profileUpdates)
                .eq('id', id)
                .select();

            if (error) throw error;
            return sendResponse(res, 200, true, 'User updated successfully', { user: data[0] });
        }

        return sendResponse(res, 200, true, 'User updated successfully');

    } catch (error) {
        console.error("Update User Error:", error);
        return sendResponse(res, 400, false, 'Update failed', null, error);
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Try to delete from Supabase Auth
        const { error: authError } = await supabase.auth.admin.deleteUser(id);

        if (authError) {
            // If user is not found in Auth, just log it and proceed to delete from public table
            // This allows cleaning up "ghost" users who exist in public schema but not in Auth.
            if (authError.status === 404 || authError.code === 'user_not_found') {
                console.warn(`User ${id} not found in Auth, proceeding to delete from public table.`);
            } else {
                // For other errors (e.g. permission), throw them
                throw authError;
            }
        }

        // 1.5 Delete from dependent tables (Manual Cascade)
        // Order matters if there are dependencies between these tables, but usually they just depend on user_id.
        // We use Promise.all for parallelism where safe, or sequential if FK's exist between them.
        // Assuming no strict FKs between orders<->payments for deletion (or if they do, delete child first).

        const tablesToDelete = ['telegram_access', 'user_subscriptions', 'payments', 'orders'];

        for (const table of tablesToDelete) {
            const { error: cascadeError } = await supabase.from(table).delete().eq('user_id', id);
            if (cascadeError) {
                console.warn(`Failed to cascade delete from ${table} for user ${id}:`, cascadeError.message);
                // We might want to throw here, or continue best-effort. 
                // For now, if we can't delete orders, we can't delete user.
                throw cascadeError;
            }
        }

        // 2. Delete from public 'users' table
        const { error: dbError } = await supabase.from('users').delete().eq('id', id);

        if (dbError) throw dbError;

        // Audit
        await logAudit(req.user.sub, `Deleted User: ${id}`, req);

        return sendResponse(res, 200, true, 'User deleted successfully');
    } catch (error) {
        console.error("Delete User Error:", error);
        return sendResponse(res, 400, false, 'Delete failed', null, error);
    }
};

// --- Subscription Plans Management ---

exports.getPlans = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('subscription_plans')
            .select('*')
            .eq('is_active', true)
            .order('price', { ascending: true });

        if (error) throw error;
        return sendResponse(res, 200, true, 'Plans fetched', data);
    } catch (error) {
        return sendResponse(res, 500, false, 'Error fetching plans', null, error);
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
        // Audit
        await logAudit(req.user.sub, `Created Plan: ${name}`, req);

        return sendResponse(res, 201, true, 'Plan created', data[0]);
    } catch (error) {
        return sendResponse(res, 400, false, 'Failed to create plan', null, error);
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
        return sendResponse(res, 200, true, 'Plan updated', data[0]);
    } catch (error) {
        return sendResponse(res, 400, false, 'Failed to update plan', null, error);
    }
};

exports.deletePlan = async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('subscription_plans')
            .update({ is_active: false })
            .eq('id', id)
            .select();

        if (error) throw error;
        // Audit
        await logAudit(req.user.sub, `Deactivated Plan: ${id}`, req);

        return sendResponse(res, 200, true, 'Plan deactivated', { plan: data[0] });
    } catch (error) {
        return sendResponse(res, 400, false, 'Failed to delete plan', null, error);
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

        // Map data for frontend (end_date -> expires_at, etc.)
        const formattedData = data.map(sub => ({
            ...sub,
            expires_at: sub.end_date,
            plan_name: sub.subscription_plans?.name,
            plan_info: sub.subscription_plans
        }));

        return sendResponse(res, 200, true, 'Subscriptions fetched', formattedData);
    } catch (error) {
        return sendResponse(res, 500, false, 'Error fetching subscriptions', null, error);
    }
};

exports.grantSubscription = async (req, res) => {
    try {
        const { email, planId, durationInDays } = req.body;

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (userError || !user) {
            return sendResponse(res, 404, false, 'User not found');
        }

        // Resolve Plan ID
        let resolvedPlanId = planId;
        // Simple UUID regex
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(planId);

        if (!isUUID) {
            // Try to find plan by name (case insensitive)
            const { data: plan, error: planError } = await supabase
                .from('subscription_plans')
                .select('id, duration_days')
                // "Monthly", "Quarterly", "Yearly"
                .ilike('name', planId)
                .maybeSingle();

            if (planError || !plan) {
                return sendResponse(res, 404, false, `Plan '${planId}' not found. Valid plans: Monthly, Quarterly, Yearly.`);
            }
            resolvedPlanId = plan.id;
        }

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + (durationInDays || 30));

        const { data, error } = await supabase
            .from('user_subscriptions')
            .insert([{
                user_id: user.id,
                plan_id: resolvedPlanId,
                start_date: startDate,
                end_date: endDate,
                status: 'active'
            }])
            .select();

        if (error) throw error;
        // Audit
        await logAudit(req.user.sub, `Granted Subscription to: ${email}`, req);

        return sendResponse(res, 201, true, 'Subscription granted', { subscription: data[0] });
    } catch (error) {
        console.error(error);
        return sendResponse(res, 400, false, 'Failed to grant subscription', null, error);
    }
};

exports.revokeSubscription = async (req, res) => {
    try {
        const { subscriptionId } = req.body;
        const { error } = await supabase
            .from('user_subscriptions')
            .update({
                status: 'cancelled',
                end_date: new Date() // Expire immediately
            })
            .eq('id', subscriptionId);

        if (error) throw error;
        // Audit
        await logAudit(req.user.sub, `Revoked Subscription: ${subscriptionId}`, req);

        return sendResponse(res, 200, true, 'Subscription revoked successfully');
    } catch (error) {
        console.error("Revoke Subscription Error:", error);
        return sendResponse(res, 400, false, 'Failed to revoke subscription', null, error);
    }
};

exports.getWebhooks = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const { data, count, error } = await supabase
            .from('webhook_logs')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error;

        return sendResponse(res, 200, true, 'Webhooks fetched', {
            webhooks: data,
            totalCount: count,
            page: parseInt(page),
            totalPages: Math.ceil((count || 0) / limit)
        });
    } catch (error) {
        return sendResponse(res, 500, false, 'Error fetching webhooks', null, error);
    }
};

// --- Payments & Export ---

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

        return sendResponse(res, 200, true, 'Payments fetched', {
            payments: data,
            count,
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (error) {
        return sendResponse(res, 500, false, 'Error fetching payments', null, error);
    }
};

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
                return sendResponse(res, 400, false, 'Invalid export type');
        }

        const { data, error } = await query;
        if (error) throw error;

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
        return sendResponse(res, 500, false, 'Export failed', null, error);
    }
};

// --- Generic Tables (Legacy) ---
exports.getTables = async (req, res) => {
    try {
        const { data, error } = await supabase.rpc('get_tables', {});
        if (error) throw error;
        const tables = data.map(t => t.table_name);
        return sendResponse(res, 200, true, 'Tables fetched', { tables });
    } catch (error) {
        return sendResponse(res, 500, false, 'Error fetching tables', null, error);
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

        return sendResponse(res, 200, true, 'Data fetched', {
            data,
            count,
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (error) {
        return sendResponse(res, 500, false, `Error fetching data for ${req.params.tableName}`, null, error);
    }
};
