const { z } = require('zod');
const { password, email, uuid } = require('../../utils/validators');

/**
 * Admin request validation.
 *
 * Password rules are imported rather than redeclared: this endpoint previously
 * allowed 6 characters while self-service registration required 10.
 */

const fullName = z.string().trim().min(2, 'Name must be at least 2 characters').max(120);

exports.createUserSchema = {
    body: z.object({
        email,
        password,
        full_name: fullName,
        role: z.enum(['user', 'admin']).optional(),
    }),
};

exports.updateUserSchema = {
    params: z.object({ id: uuid }),
    body: z.object({
        email: email.optional(),
        // An empty string means "leave the password alone".
        password: password.optional().or(z.literal('')),
        full_name: fullName.optional(),
        role: z.enum(['user', 'admin']).optional(),
        is_active: z.boolean().optional(),
    }),
};

exports.userIdSchema = { params: z.object({ id: uuid }) };

exports.grantSubscriptionSchema = {
    body: z.object({
        email,
        // Accepts a plan UUID or a plan name.
        planId: z.string().trim().min(1),
        durationInDays: z.number().int().positive().max(3650).optional(),
    }),
};

exports.revokeSubscriptionSchema = {
    body: z.object({ subscriptionId: uuid }),
};

exports.createPlanSchema = {
    body: z.object({
        name: z.string().trim().min(2).max(80),
        // Whole rupees; razorpay.service converts to paise.
        price: z.number().int().nonnegative(),
        sale_price: z.number().int().nonnegative().optional(),
        duration_days: z.number().int().positive().max(3650),
        description: z.string().max(500).optional(),
    }),
};

exports.updatePlanSchema = {
    params: z.object({ id: uuid }),
    body: z.object({
        name: z.string().trim().min(2).max(80).optional(),
        price: z.number().int().nonnegative().optional(),
        sale_price: z.number().int().nonnegative().optional(),
        duration_days: z.number().int().positive().max(3650).optional(),
        description: z.string().max(500).optional(),
        is_active: z.boolean().optional(),
        sort_order: z.number().int().optional(),
    }),
};

exports.planIdSchema = { params: z.object({ id: uuid }) };
