const db = require('../../config/db');

/**
 * Address CRUD.
 *
 * Every mutating query carries `user_id = $n` in its WHERE clause. That is the
 * only thing preventing one user from editing another's address, so it must
 * never be dropped — there is no row-level security behind it.
 */

const COLUMNS = `id, user_id, full_name, phone, street, city, state, pincode,
                 country, is_default, created_at, updated_at`;

exports.getAddress = (userId) =>
    db.many(
        `SELECT ${COLUMNS} FROM addresses
          WHERE user_id = $1
       ORDER BY is_default DESC, created_at DESC`,
        [userId]
    );

exports.addAddress = async (userId, addressData) => {
    const { fullName, phone, street, city, state, pincode, country, isDefault } = addressData;

    return db.tx(async (t) => {
        // A partial unique index enforces one default per user, so an existing
        // default must be cleared first or the insert violates it.
        if (isDefault) {
            await t.query(
                `UPDATE addresses SET is_default = FALSE WHERE user_id = $1 AND is_default`,
                [userId]
            );
        }

        return t.one(
            `INSERT INTO addresses (user_id, full_name, phone, street, city, state,
                                    pincode, country, is_default)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, FALSE))
             RETURNING ${COLUMNS}`,
            [userId, fullName, phone, street, city, state, pincode, country, isDefault]
        );
    });
};

exports.updateAddress = async (userId, addressId, addressData) => {
    const { fullName, phone, street, city, state, pincode, country, isDefault } = addressData;

    return db.tx(async (t) => {
        if (isDefault) {
            await t.query(
                `UPDATE addresses SET is_default = FALSE
                  WHERE user_id = $1 AND is_default AND id <> $2`,
                [userId, addressId]
            );
        }

        // COALESCE keeps unspecified fields at their current value, matching the
        // partial-update semantics the previous implementation had.
        return t.one(
            `UPDATE addresses
                SET full_name  = COALESCE($3, full_name),
                    phone      = COALESCE($4, phone),
                    street     = COALESCE($5, street),
                    city       = COALESCE($6, city),
                    state      = COALESCE($7, state),
                    pincode    = COALESCE($8, pincode),
                    country    = COALESCE($9, country),
                    is_default = COALESCE($10, is_default)
              WHERE id = $2 AND user_id = $1
          RETURNING ${COLUMNS}`,
            [userId, addressId, fullName, phone, street, city, state, pincode, country, isDefault]
        );
    });
};

exports.deleteAddress = async (userId, addressId) => {
    const { rowCount } = await db.query(
        `DELETE FROM addresses WHERE id = $1 AND user_id = $2`,
        [addressId, userId]
    );
    return { deleted: rowCount > 0 };
};
