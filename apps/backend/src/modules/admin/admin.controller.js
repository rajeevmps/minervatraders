const bcrypt = require('bcryptjs');
const db = require('../../config/db');
const userRepository = require('../user/user.repository');
const tokenService = require('../auth/token.service');
const { sendResponse } = require('../../utils/responseHelper');
const { bcryptRounds } = require('../../config/env');
const logger = require('../../utils/logger');

/**
 * Admin API.
 *
 * Note on pagination: Supabase `.range(from, to)` bounds are INCLUSIVE, whereas
 * SQL LIMIT/OFFSET is a count plus a skip. Every converted endpoint therefore
 * uses LIMIT $limit OFFSET $offset — translating `to` directly into LIMIT would
 * have returned one row too few on every page.
 */

// --- helpers ---------------------------------------------------------------

const parsePagination = (query, defaultLimit = 20) => {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
    return { page, limit, offset: (page - 1) * limit };
};

const paged = (rows, { page, limit }) => {
    const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
    return {
        items: rows.map(({ total_count: _drop, ...rest }) => rest),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
};

const logAudit = async (userId, action, req, details = {}) => {
    try {
        await db.query(
            `INSERT INTO audit_logs (user_id, action, details, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5)`,
            [userId, action, details, req.ip || null, req.get('user-agent') || null]
        );
    } catch (error) {
        // Auditing must never break the operation it records.
        logger.error('Audit log write failed', { action, error: error.message });
    }
};

// --- dashboard -------------------------------------------------------------

exports.getStats = async (req, res, next) => {
    try {
        // One round trip instead of four parallel queries, and revenue is summed
        // by Postgres rather than by pulling every payment row into Node.
        const stats = await db.one(`
            SELECT
              (SELECT count(*) FROM users)                                        AS total_users,
              (SELECT count(*) FROM user_subscriptions
                WHERE status = 'active' AND end_date >= now())                    AS active_subscriptions,
              (SELECT COALESCE(sum(amount), 0) FROM payments
                WHERE status = 'captured')                                        AS total_revenue,
              (SELECT count(*) FROM users
                WHERE created_at >= now() - interval '30 days')                    AS new_users_30d
        `);

        const recentLogs = await db.many(
            `SELECT a.action, a.details, a.created_at, u.full_name, u.email
               FROM audit_logs a
               LEFT JOIN users u ON u.id = a.user_id
           ORDER BY a.created_at DESC
              LIMIT 5`
        );

        return sendResponse(res, 200, true, 'Stats fetched successfully', {
            totalUsers: Number(stats.total_users),
            activeSubscriptions: Number(stats.active_subscriptions),
            totalRevenue: Number(stats.total_revenue),
            newUsers30d: Number(stats.new_users_30d),
            recentLogs,
            systemHealth: 'Optimal',
        });
    } catch (error) {
        return next(error);
    }
};

exports.getAuditLogs = async (req, res, next) => {
    try {
        const { page, limit, offset } = parsePagination(req.query);
        const { userId } = req.query;

        const rows = await db.many(
            `SELECT a.id, a.action, a.details, a.ip_address, a.user_agent, a.created_at,
                    u.email, u.full_name,
                    count(*) OVER() AS total_count
               FROM audit_logs a
               LEFT JOIN users u ON u.id = a.user_id
              WHERE ($3::uuid IS NULL OR a.user_id = $3::uuid)
           ORDER BY a.created_at DESC
              LIMIT $1 OFFSET $2`,
            [limit, offset, userId || null]
        );

        return sendResponse(res, 200, true, 'Audit logs fetched', paged(rows, { page, limit }));
    } catch (error) {
        return next(error);
    }
};

// --- user management -------------------------------------------------------

exports.getUsers = async (req, res, next) => {
    try {
        const { page, limit, offset } = parsePagination(req.query, 10);
        const search = req.query.search?.trim() || null;

        // The search term is a bound parameter. The Supabase version
        // interpolated it directly into an `.or()` filter string.
        const rows = await db.many(
            `SELECT u.id, u.email, u.full_name, u.avatar_url, u.role, u.is_active,
                    u.telegram_username, u.email_verified, u.last_login_at, u.created_at,
                    s.status AS subscription_status,
                    s.end_date AS subscription_ends_at,
                    p.name AS plan_name,
                    count(*) OVER() AS total_count
               FROM users u
               LEFT JOIN user_subscriptions s
                      ON s.user_id = u.id AND s.status = 'active'
               LEFT JOIN subscription_plans p ON p.id = s.plan_id
              WHERE ($3::text IS NULL
                     OR u.email ILIKE '%' || $3 || '%'
                     OR u.full_name ILIKE '%' || $3 || '%')
           ORDER BY u.created_at DESC
              LIMIT $1 OFFSET $2`,
            [limit, offset, search]
        );

        return sendResponse(res, 200, true, 'Users fetched successfully', paged(rows, { page, limit }));
    } catch (error) {
        return next(error);
    }
};

exports.createUser = async (req, res, next) => {
    try {
        const { email, password, full_name: fullName, role } = req.body;

        const existing = await userRepository.findByEmail(email);
        if (existing) {
            return sendResponse(res, 409, false, 'A user with this email already exists', null, {
                code: 'EMAIL_TAKEN',
            });
        }

        const passwordHash = await bcrypt.hash(password, bcryptRounds);

        // Role now lives on the user row, so this is a single insert. Previously
        // it meant a GoTrue call, a profile upsert and an `admins` upsert, any
        // of which could fail independently and leave inconsistent state.
        const user = await userRepository.create({
            email,
            passwordHash,
            fullName,
            role: role === 'admin' ? 'admin' : 'user',
            emailVerified: true,
        });

        await logAudit(req.user.sub, 'user.create', req, { targetUserId: user.id, email, role });

        return sendResponse(res, 201, true, 'User created successfully', { user });
    } catch (error) {
        return next(error);
    }
};

exports.updateUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { password, email, role, full_name: fullName, is_active: isActive } = req.body;

        const target = await userRepository.findById(id);
        if (!target) {
            return sendResponse(res, 404, false, 'User not found', null, { code: 'NOT_FOUND' });
        }

        // Guard against an admin locking themselves out mid-session.
        if (id === req.user.sub && (role === 'user' || isActive === false)) {
            return sendResponse(res, 400, false, 'You cannot revoke your own admin access', null, {
                code: 'SELF_DEMOTION',
            });
        }

        const user = await db.tx(async (t) => {
            const updated = await userRepository.update(
                id,
                { email, fullName, role, isActive },
                t
            );

            if (password && password.trim()) {
                const passwordHash = await bcrypt.hash(password.trim(), bcryptRounds);
                await userRepository.updatePassword(id, passwordHash, t);
                // An admin-forced password change must invalidate live sessions.
                await tokenService.revokeAllForUser(id, t);
            }

            if (isActive === false) {
                await tokenService.revokeAllForUser(id, t);
            }

            return updated;
        });

        await logAudit(req.user.sub, 'user.update', req, { targetUserId: id, role, isActive });

        return sendResponse(res, 200, true, 'User updated successfully', { user });
    } catch (error) {
        return next(error);
    }
};

exports.deleteUser = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (id === req.user.sub) {
            return sendResponse(res, 400, false, 'You cannot delete your own account', null, {
                code: 'SELF_DELETE',
            });
        }

        const target = await userRepository.findById(id);
        if (!target) {
            return sendResponse(res, 404, false, 'User not found', null, { code: 'NOT_FOUND' });
        }

        // Foreign keys declare ON DELETE CASCADE / SET NULL, so the database
        // handles dependants. The old manual loop over four tables existed only
        // because the Supabase schema lacked those rules.
        await userRepository.remove(id);

        await logAudit(req.user.sub, 'user.delete', req, {
            targetUserId: id,
            email: target.email,
        });

        return sendResponse(res, 200, true, 'User deleted successfully');
    } catch (error) {
        return next(error);
    }
};

// --- plans -----------------------------------------------------------------

exports.getPlans = async (req, res, next) => {
    try {
        const plans = await db.many(
            `SELECT id, name, description, price, sale_price, currency, duration_days,
                    is_active, sort_order, created_at
               FROM subscription_plans
           ORDER BY sort_order ASC, price ASC`
        );
        return sendResponse(res, 200, true, 'Plans fetched', plans);
    } catch (error) {
        return next(error);
    }
};

exports.createPlan = async (req, res, next) => {
    try {
        const { name, price, duration_days: durationDays, description, sale_price: salePrice } = req.body;

        const plan = await db.one(
            `INSERT INTO subscription_plans (name, price, sale_price, duration_days, description, is_active)
             VALUES ($1, $2, $3, $4, $5, TRUE)
             RETURNING *`,
            [name, price, salePrice ?? null, durationDays, description ?? null]
        );

        await logAudit(req.user.sub, 'plan.create', req, { planId: plan.id, name });
        return sendResponse(res, 201, true, 'Plan created', plan);
    } catch (error) {
        return next(error);
    }
};

exports.updatePlan = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, price, sale_price: salePrice, duration_days: durationDays,
                description, is_active: isActive, sort_order: sortOrder } = req.body;

        const plan = await db.one(
            `UPDATE subscription_plans
                SET name          = COALESCE($2, name),
                    price         = COALESCE($3, price),
                    sale_price    = COALESCE($4, sale_price),
                    duration_days = COALESCE($5, duration_days),
                    description   = COALESCE($6, description),
                    is_active     = COALESCE($7, is_active),
                    sort_order    = COALESCE($8, sort_order)
              WHERE id = $1
          RETURNING *`,
            [id, name, price, salePrice, durationDays, description, isActive, sortOrder]
        );

        if (!plan) {
            return sendResponse(res, 404, false, 'Plan not found', null, { code: 'NOT_FOUND' });
        }

        await logAudit(req.user.sub, 'plan.update', req, { planId: id });
        return sendResponse(res, 200, true, 'Plan updated', plan);
    } catch (error) {
        return next(error);
    }
};

exports.deletePlan = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Soft delete: order_items reference plans with ON DELETE RESTRICT, so a
        // hard delete would fail for any plan that has ever been purchased.
        const plan = await db.one(
            `UPDATE subscription_plans SET is_active = FALSE WHERE id = $1 RETURNING *`,
            [id]
        );

        if (!plan) {
            return sendResponse(res, 404, false, 'Plan not found', null, { code: 'NOT_FOUND' });
        }

        await logAudit(req.user.sub, 'plan.deactivate', req, { planId: id });
        return sendResponse(res, 200, true, 'Plan deactivated', { plan });
    } catch (error) {
        return next(error);
    }
};

// --- subscriptions ---------------------------------------------------------

exports.getSubscriptions = async (req, res, next) => {
    try {
        const { page, limit, offset } = parsePagination(req.query);
        const status = req.query.status || 'active';

        const rows = await db.many(
            `SELECT s.id, s.user_id, s.plan_id, s.start_date, s.end_date, s.status, s.created_at,
                    s.end_date AS expires_at,
                    u.email, u.full_name,
                    p.name AS plan_name, p.price AS plan_price,
                    count(*) OVER() AS total_count
               FROM user_subscriptions s
               JOIN users u ON u.id = s.user_id
               JOIN subscription_plans p ON p.id = s.plan_id
              WHERE ($3::text = 'all' OR s.status = $3::text)
           ORDER BY s.created_at DESC
              LIMIT $1 OFFSET $2`,
            [limit, offset, status]
        );

        return sendResponse(res, 200, true, 'Subscriptions fetched', paged(rows, { page, limit }));
    } catch (error) {
        return next(error);
    }
};

exports.grantSubscription = async (req, res, next) => {
    try {
        const { email, planId, durationInDays } = req.body;

        const user = await userRepository.findByEmail(email);
        if (!user) {
            return sendResponse(res, 404, false, 'User not found', null, { code: 'USER_NOT_FOUND' });
        }

        // planId accepts either a UUID or a plan name, as before.
        const plan = await db.one(
            `SELECT id, duration_days FROM subscription_plans
              WHERE ($1::uuid IS NOT NULL AND id = $1::uuid) OR name ILIKE $2
              LIMIT 1`,
            [isUuid(planId) ? planId : null, planId]
        );

        if (!plan) {
            return sendResponse(res, 404, false, `Plan '${planId}' not found`, null, {
                code: 'PLAN_NOT_FOUND',
            });
        }

        const days = durationInDays || plan.duration_days;

        const subscription = await db.tx(async (t) => {
            // Required by the one-active-subscription-per-user partial index.
            await t.query(
                `UPDATE user_subscriptions SET status = 'expired'
                  WHERE user_id = $1 AND status = 'active'`,
                [user.id]
            );

            return t.one(
                `INSERT INTO user_subscriptions (user_id, plan_id, start_date, end_date, status)
                 VALUES ($1, $2, now(), now() + make_interval(days => $3), 'active')
                 RETURNING *`,
                [user.id, plan.id, days]
            );
        });

        await logAudit(req.user.sub, 'subscription.grant', req, {
            targetUserId: user.id,
            email,
            planId: plan.id,
            days,
        });

        return sendResponse(res, 201, true, 'Subscription granted', { subscription });
    } catch (error) {
        return next(error);
    }
};

exports.revokeSubscription = async (req, res, next) => {
    try {
        const { subscriptionId } = req.body;

        const subscription = await db.one(
            `UPDATE user_subscriptions
                SET status = 'cancelled', end_date = now()
              WHERE id = $1
          RETURNING *`,
            [subscriptionId]
        );

        if (!subscription) {
            return sendResponse(res, 404, false, 'Subscription not found', null, {
                code: 'NOT_FOUND',
            });
        }

        await logAudit(req.user.sub, 'subscription.revoke', req, { subscriptionId });
        return sendResponse(res, 200, true, 'Subscription revoked successfully', { subscription });
    } catch (error) {
        return next(error);
    }
};

// --- payments & webhooks ---------------------------------------------------

exports.getPayments = async (req, res, next) => {
    try {
        const { page, limit, offset } = parsePagination(req.query);

        const rows = await db.many(
            `SELECT p.id, p.order_id, p.razorpay_payment_id, p.amount, p.currency,
                    p.status, p.method, p.webhook_event, p.created_at,
                    u.email, u.full_name,
                    count(*) OVER() AS total_count
               FROM payments p
               LEFT JOIN users u ON u.id = p.user_id
           ORDER BY p.created_at DESC
              LIMIT $1 OFFSET $2`,
            [limit, offset]
        );

        return sendResponse(res, 200, true, 'Payments fetched', paged(rows, { page, limit }));
    } catch (error) {
        return next(error);
    }
};

exports.getWebhooks = async (req, res, next) => {
    try {
        const { page, limit, offset } = parsePagination(req.query);

        const rows = await db.many(
            `SELECT id, provider, event_type, event_id, processed, error, created_at,
                    count(*) OVER() AS total_count
               FROM webhook_logs
           ORDER BY created_at DESC
              LIMIT $1 OFFSET $2`,
            [limit, offset]
        );

        return sendResponse(res, 200, true, 'Webhooks fetched', paged(rows, { page, limit }));
    } catch (error) {
        return next(error);
    }
};

// --- export ----------------------------------------------------------------

const EXPORTS = {
    users: `SELECT id, email, full_name, role, is_active, email_verified,
                   telegram_username, last_login_at, created_at FROM users ORDER BY created_at DESC`,
    subscriptions: `SELECT s.id, u.email, p.name AS plan, s.status, s.start_date,
                           s.end_date, s.created_at
                      FROM user_subscriptions s
                      JOIN users u ON u.id = s.user_id
                      JOIN subscription_plans p ON p.id = s.plan_id
                  ORDER BY s.created_at DESC`,
    payments: `SELECT p.id, u.email, p.amount, p.currency, p.status, p.method,
                      p.razorpay_payment_id, p.created_at
                 FROM payments p
                 LEFT JOIN users u ON u.id = p.user_id
             ORDER BY p.created_at DESC`,
};

exports.exportData = async (req, res, next) => {
    try {
        const { type } = req.params;
        const sql = EXPORTS[type];

        if (!sql) {
            return sendResponse(res, 400, false, 'Invalid export type', null, {
                code: 'INVALID_EXPORT_TYPE',
                details: `Valid types: ${Object.keys(EXPORTS).join(', ')}`,
            });
        }

        const rows = await db.many(sql);
        await logAudit(req.user.sub, 'data.export', req, { type, rowCount: rows.length });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${type}-${new Date().toISOString().slice(0, 10)}.csv"`
        );
        return res.send(toCsv(rows));
    } catch (error) {
        return next(error);
    }
};

/** RFC-4180 CSV with spreadsheet formula-injection neutralised. */
function toCsv(rows) {
    if (!rows.length) return '';
    const keys = Object.keys(rows[0]);
    const escape = (value) => {
        if (value === null || value === undefined) return '""';
        let str = typeof value === 'object' ? JSON.stringify(value) : String(value);
        // A leading =, +, - or @ is executed as a formula by Excel and Sheets.
        if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
        return `"${str.replace(/"/g, '""')}"`;
    };
    return [keys.join(','), ...rows.map((row) => keys.map((k) => escape(row[k])).join(','))].join('\n');
}

// --- generic table browser -------------------------------------------------

/**
 * Strict whitelist. The previous implementation passed req.params.tableName
 * straight into `.from()`, which becomes an injection vector the moment it is
 * expressed as SQL. Identifiers cannot be bound as parameters, so an allow-list
 * is the only safe approach.
 */
const BROWSABLE_TABLES = Object.freeze([
    'users', 'subscription_plans', 'user_subscriptions', 'orders', 'order_items',
    'payments', 'addresses', 'telegram_access', 'webhook_logs', 'audit_logs',
    'system_settings',
]);

exports.getTables = async (req, res) =>
    sendResponse(res, 200, true, 'Tables fetched', { tables: BROWSABLE_TABLES });

exports.getTableData = async (req, res, next) => {
    try {
        const { tableName } = req.params;
        const { page, limit, offset } = parsePagination(req.query);

        if (!BROWSABLE_TABLES.includes(tableName)) {
            return sendResponse(res, 400, false, 'Unknown or restricted table', null, {
                code: 'TABLE_NOT_ALLOWED',
            });
        }

        // Safe to interpolate: tableName is provably one of the frozen literals
        // above, never caller-supplied text.
        const rows = await db.many(
            `SELECT *, count(*) OVER() AS total_count
               FROM ${tableName}
              LIMIT $1 OFFSET $2`,
            [limit, offset]
        );

        // users is browsable, but its password hashes must never be served.
        const sanitised = rows.map(({ total_count: _drop, password_hash: _secret, ...rest }) => rest);

        return sendResponse(res, 200, true, 'Data fetched', {
            data: sanitised,
            total: rows.length > 0 ? Number(rows[0].total_count) : 0,
            page,
            limit,
        });
    } catch (error) {
        return next(error);
    }
};

const isUuid = (value) =>
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

exports.logAudit = logAudit;
