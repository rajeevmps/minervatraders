const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../../src/config/db');

/**
 * Test data builders.
 *
 * Each returns the created row so tests can assert against real ids. Every
 * field has a sane default, so a test only states what it actually cares about.
 */

const uniqueEmail = (prefix = 'user') =>
    `${prefix}-${crypto.randomBytes(6).toString('hex')}@example.test`;

/** Cost 10 matches BCRYPT_ROUNDS in the test env, keeping hashing cheap. */
const hash = (password) => bcrypt.hashSync(password, 10);

const DEFAULT_PASSWORD = 'TestPassword123';

async function createUser({
    email = uniqueEmail(),
    password = DEFAULT_PASSWORD,
    fullName = 'Test User',
    role = 'user',
    isActive = true,
    telegramUserId = null,
    emailVerified = true,
} = {}) {
    const user = await db.one(
        `INSERT INTO users (email, password_hash, full_name, role, is_active,
                            telegram_user_id, email_verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [email, hash(password), fullName, role, isActive, telegramUserId, emailVerified]
    );
    // The plaintext is attached for convenience; it is never persisted.
    return { ...user, password };
}

const createAdmin = (overrides = {}) => createUser({ role: 'admin', ...overrides });

async function createPlan({
    name = `Plan ${crypto.randomBytes(3).toString('hex')}`,
    price = 3000,
    durationDays = 30,
    isActive = true,
    salePrice = null,
} = {}) {
    return db.one(
        `INSERT INTO subscription_plans (name, price, sale_price, duration_days, is_active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [name, price, salePrice, durationDays, isActive]
    );
}

/**
 * @param {number} daysRemaining negative to create an already-lapsed subscription
 *
 * start_date is anchored 30 days before end_date rather than at a fixed point
 * in the past, so a negative daysRemaining still satisfies the subs_date_order
 * check constraint (end_date > start_date).
 */
async function createSubscription({ userId, planId, status = 'active', daysRemaining = 30 }) {
    return db.one(
        `INSERT INTO user_subscriptions (user_id, plan_id, start_date, end_date, status)
         VALUES ($1, $2,
                 now() + make_interval(days => $3) - interval '30 days',
                 now() + make_interval(days => $3),
                 $4)
         RETURNING *`,
        [userId, planId, daysRemaining, status]
    );
}

async function createOrder({ userId, planId, amount = 3000, status = 'pending', razorpayOrderId = null }) {
    const order = await db.one(
        `INSERT INTO orders (user_id, total_amount, status, razorpay_order_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, amount, status, razorpayOrderId]
    );
    await db.query(
        `INSERT INTO order_items (order_id, plan_id, price) VALUES ($1, $2, $3)`,
        [order.id, planId, amount]
    );
    await db.query(
        `INSERT INTO payments (user_id, order_id, amount, status) VALUES ($1, $2, $3, 'pending')`,
        [userId, order.id, amount]
    );
    return order;
}

async function createTelegramAccess({ userId, telegramUserId = 555001, status = 'invited' }) {
    return db.one(
        `INSERT INTO telegram_access (user_id, telegram_user_id, status, is_active, expires_at)
         VALUES ($1, $2, $3, TRUE, now() + interval '1 day')
         RETURNING *`,
        [userId, telegramUserId, status]
    );
}

module.exports = {
    DEFAULT_PASSWORD,
    uniqueEmail,
    createUser,
    createAdmin,
    createPlan,
    createSubscription,
    createOrder,
    createTelegramAccess,
};
