const { z } = require('zod');
const { password, email } = require('../../utils/validators');

/**
 * Request validation for the auth module. The password and email rules are
 * shared with the admin module via utils/validators so a single policy applies
 * everywhere a credential is set.
 */

/**
 * Telegram Login Widget payload. Passthrough is required: the HMAC is computed
 * over EVERY field Telegram sends, so stripping unknown keys would break
 * signature verification whenever Telegram adds a field.
 */
const telegramPayload = z
    .object({
        id: z.union([z.string(), z.number()]),
        auth_date: z.union([z.string(), z.number()]),
        hash: z.string().min(1),
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        username: z.string().optional(),
        photo_url: z.string().optional(),
    })
    .passthrough();

module.exports = {
    registerSchema: {
        body: z.object({
            email,
            password,
            fullName: z.string().trim().min(1).max(120).optional(),
        }),
    },

    loginSchema: {
        body: z.object({
            email,
            // Not the `password` rule: login must not advertise the policy, and
            // an account created before a policy change still needs to sign in.
            password: z.string().min(1, 'Password is required'),
        }),
    },

    telegramLoginSchema: { body: telegramPayload },

    changePasswordSchema: {
        body: z.object({
            currentPassword: z.string().optional(),
            newPassword: password,
        }),
    },
};
