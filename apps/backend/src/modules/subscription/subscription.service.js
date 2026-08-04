const db = require('../../config/db');

/**
 * Subscription lifecycle.
 *
 * Two correctness fixes over the Supabase implementation:
 *
 *   1. Expiring the old subscription and inserting the new one now happen in
 *      ONE transaction. Previously a failure between the two steps left the
 *      user with no active subscription despite having paid.
 *   2. End dates are computed by Postgres from `now()` rather than in Node.
 *      The old code built dates from the server's local clock and stored them
 *      in a naive TIMESTAMP column, so expiry drifted by the UTC offset.
 */

const SUBSCRIPTION_WITH_PLAN = `
    SELECT s.id, s.user_id, s.plan_id, s.order_id, s.start_date, s.end_date,
           s.status, s.created_at, s.updated_at,
           json_build_object(
               'id', p.id, 'name', p.name, 'price', p.price,
               'sale_price', p.sale_price, 'currency', p.currency,
               'duration_days', p.duration_days
           ) AS plan
      FROM user_subscriptions s
      JOIN subscription_plans p ON p.id = s.plan_id
`;

exports.createSubscription = async (userId, planId, orderId = null) =>
    db.tx(async (t) => {
        const plan = await t.one(
            `SELECT id, duration_days FROM subscription_plans WHERE id = $1`,
            [planId]
        );
        if (!plan) {
            const error = new Error('Plan not found');
            error.status = 404;
            error.code = 'PLAN_NOT_FOUND';
            throw error;
        }

        // Must run before the insert: a partial unique index permits only one
        // active subscription per user.
        await t.query(
            `UPDATE user_subscriptions SET status = 'expired'
              WHERE user_id = $1 AND status = 'active'`,
            [userId]
        );

        return t.one(
            `INSERT INTO user_subscriptions (user_id, plan_id, order_id, start_date, end_date, status)
             VALUES ($1, $2, $3, now(), now() + make_interval(days => $4), 'active')
             RETURNING *`,
            [userId, planId, orderId, plan.duration_days]
        );
    });

/** Currently active, not-yet-expired subscription. null when there is none. */
exports.getActiveSubscription = (userId) =>
    db.one(
        `${SUBSCRIPTION_WITH_PLAN}
          WHERE s.user_id = $1 AND s.status = 'active' AND s.end_date >= now()
       ORDER BY s.end_date DESC
          LIMIT 1`,
        [userId]
    );

exports.getSubscriptionHistory = (userId) =>
    db.many(`${SUBSCRIPTION_WITH_PLAN} WHERE s.user_id = $1 ORDER BY s.created_at DESC`, [userId]);

exports.getAllPlans = () =>
    db.many(
        `SELECT id, name, description, price, sale_price, currency, duration_days, sort_order
           FROM subscription_plans
          WHERE is_active = TRUE
       ORDER BY sort_order ASC, price ASC`
    );

exports.cancelSubscription = (userId, subscriptionId) =>
    db.one(
        `UPDATE user_subscriptions
            SET status = 'cancelled'
          WHERE id = $1 AND user_id = $2 AND status = 'active'
      RETURNING *`,
        [subscriptionId, userId]
    );
