const db = require('../../config/db');

/**
 * Order history.
 *
 * The Supabase version used the embed `select('*, items:order_items(*)')`.
 * A correlated json_agg reproduces it in one round trip, with an explicit
 * empty array rather than null when an order has no items.
 */

const ORDER_WITH_ITEMS = `
    SELECT o.id, o.user_id, o.total_amount, o.currency, o.status,
           o.razorpay_order_id, o.created_at, o.updated_at,
           COALESCE((
               SELECT json_agg(json_build_object(
                          'id', oi.id,
                          'order_id', oi.order_id,
                          'plan_id', oi.plan_id,
                          'price', oi.price,
                          'plan_name', p.name
                      ) ORDER BY oi.id)
                 FROM order_items oi
                 LEFT JOIN subscription_plans p ON p.id = oi.plan_id
                WHERE oi.order_id = o.id
           ), '[]'::json) AS items
      FROM orders o
`;

exports.getOrders = (userId) =>
    db.many(`${ORDER_WITH_ITEMS} WHERE o.user_id = $1 ORDER BY o.created_at DESC`, [userId]);

// The user_id predicate is the ownership check — without it any order id would
// be readable by any authenticated user.
exports.getOrderById = (userId, orderId) =>
    db.one(`${ORDER_WITH_ITEMS} WHERE o.id = $1 AND o.user_id = $2`, [orderId, userId]);
