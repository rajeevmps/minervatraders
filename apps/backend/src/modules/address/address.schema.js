const { z } = require('zod');
const { uuid } = require('../../utils/validators');

/**
 * Address validation.
 *
 * These routes previously accepted arbitrary user input with no validation at
 * all — the fields went straight from the request body into an insert.
 */

// Deliberately permissive on format (addresses vary worldwide) but bounded in
// length, so a request cannot store megabytes of text per field.
const line = (max) => z.string().trim().min(1).max(max);

const addressFields = {
    fullName: line(120),
    phone: z
        .string()
        .trim()
        .regex(/^[+]?[\d\s-]{6,20}$/, 'Must be a valid phone number'),
    street: line(255),
    city: line(80),
    state: line(80),
    pincode: line(20),
    country: line(80),
    isDefault: z.boolean().optional(),
};

exports.createAddressSchema = {
    body: z.object(addressFields),
};

exports.updateAddressSchema = {
    params: z.object({ id: uuid }),
    // Every field optional: the service COALESCEs unspecified ones.
    body: z
        .object(
            Object.fromEntries(
                Object.entries(addressFields).map(([key, schema]) => [key, schema.optional()])
            )
        )
        .refine((body) => Object.keys(body).length > 0, {
            message: 'At least one field must be supplied',
        }),
};

exports.addressIdSchema = {
    params: z.object({ id: uuid }),
};
