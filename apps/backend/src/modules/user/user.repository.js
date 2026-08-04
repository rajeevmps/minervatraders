const db = require('../../config/db');

/**
 * User persistence.
 *
 * PUBLIC_COLUMNS is the default projection everywhere. password_hash is only
 * ever read by findByEmailWithSecret, so it cannot leak into an API response by
 * accident via `SELECT *`.
 */
const PUBLIC_COLUMNS = `
    id, email, full_name, avatar_url, telegram_user_id, telegram_username,
    role, email_verified, is_active, last_login_at, created_at, updated_at
`;

const findById = (id, client = db) =>
    client.one(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);

const findByEmail = (email, client = db) =>
    client.one(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE email = $1`, [email]);

/** Login path only — includes the hash. */
const findByEmailWithSecret = (email, client = db) =>
    client.one(`SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE email = $1`, [email]);

const findByIdWithSecret = (id, client = db) =>
    client.one(`SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE id = $1`, [id]);

const findByTelegramId = (telegramUserId, client = db) =>
    client.one(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE telegram_user_id = $1`, [telegramUserId]);

const create = ({ email, passwordHash = null, fullName = null, role = 'user',
                  telegramUserId = null, telegramUsername = null, avatarUrl = null,
                  emailVerified = false }, client = db) =>
    client.one(
        `INSERT INTO users (email, password_hash, full_name, role,
                            telegram_user_id, telegram_username, avatar_url, email_verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING ${PUBLIC_COLUMNS}`,
        [email, passwordHash, fullName, role, telegramUserId, telegramUsername, avatarUrl, emailVerified]
    );

const updatePassword = (id, passwordHash, client = db) =>
    client.one(
        `UPDATE users SET password_hash = $2 WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
        [id, passwordHash]
    );

const markLoggedIn = (id, client = db) =>
    client.query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [id]);

/** Attach a Telegram identity to an existing account. */
const linkTelegram = (id, { telegramUserId, telegramUsername, avatarUrl }, client = db) =>
    client.one(
        `UPDATE users
            SET telegram_user_id  = $2,
                telegram_username = $3,
                avatar_url        = COALESCE(avatar_url, $4)
          WHERE id = $1
      RETURNING ${PUBLIC_COLUMNS}`,
        [id, telegramUserId, telegramUsername, avatarUrl]
    );

/**
 * Partial update from a whitelist. Callers pass arbitrary objects, so column
 * names are never taken from input — only keys present in ALLOWED are used.
 */
const ALLOWED_UPDATE_FIELDS = {
    fullName: 'full_name',
    avatarUrl: 'avatar_url',
    email: 'email',
    role: 'role',
    isActive: 'is_active',
    emailVerified: 'email_verified',
    telegramUsername: 'telegram_username',
};

const update = async (id, fields, client = db) => {
    const entries = Object.entries(fields).filter(
        ([key, value]) => ALLOWED_UPDATE_FIELDS[key] !== undefined && value !== undefined
    );

    if (entries.length === 0) return findById(id, client);

    const assignments = entries.map(([key], i) => `${ALLOWED_UPDATE_FIELDS[key]} = $${i + 2}`);
    const values = entries.map(([, value]) => value);

    return client.one(
        `UPDATE users SET ${assignments.join(', ')} WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
        [id, ...values]
    );
};

const remove = (id, client = db) =>
    client.query(`DELETE FROM users WHERE id = $1`, [id]);

/**
 * Admin listing with search + pagination.
 * The search term is parameterised, never interpolated.
 */
const list = async ({ limit = 20, offset = 0, search = null }, client = db) => {
    const where = search ? `WHERE email ILIKE $3 OR full_name ILIKE $3` : '';
    const params = search ? [limit, offset, `%${search}%`] : [limit, offset];

    const rows = await client.many(
        `SELECT ${PUBLIC_COLUMNS},
                count(*) OVER() AS total_count
           FROM users
           ${where}
       ORDER BY created_at DESC
          LIMIT $1 OFFSET $2`,
        params
    );

    const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
    return {
        items: rows.map(({ total_count, ...user }) => user),
        total,
    };
};

module.exports = {
    PUBLIC_COLUMNS,
    findById,
    findByEmail,
    findByEmailWithSecret,
    findByIdWithSecret,
    findByTelegramId,
    create,
    update,
    updatePassword,
    markLoggedIn,
    linkTelegram,
    remove,
    list,
};
