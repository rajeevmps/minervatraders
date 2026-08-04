const { z } = require('zod');

/**
 * Validation primitives shared across modules.
 *
 * The password rule lives here so every path that sets a password enforces the
 * same policy. Previously the admin create-user endpoint allowed 6 characters
 * while self-service registration required 10, so an admin could provision an
 * account weaker than the policy permitted.
 */

// bcrypt silently ignores input past 72 BYTES. Rejecting is clearer than
// truncating, which would leave a user believing a longer password protects them.
const BCRYPT_MAX_BYTES = 72;
const PASSWORD_MIN_LENGTH = 10;

const password = z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    .refine((value) => Buffer.byteLength(value, 'utf8') <= BCRYPT_MAX_BYTES, {
        message: `Password must be at most ${BCRYPT_MAX_BYTES} bytes`,
    });

const email = z.string().trim().toLowerCase().email('Must be a valid email address');

const uuid = z.string().uuid('Must be a valid id');

/** Path/query id parameter. */
const idParam = z.object({ id: uuid });

/** Standard page/limit query, coerced from strings. */
const pagination = z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

module.exports = {
    BCRYPT_MAX_BYTES,
    PASSWORD_MIN_LENGTH,
    password,
    email,
    uuid,
    idParam,
    pagination,
};
