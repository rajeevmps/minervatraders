const { z } = require('zod');

exports.createUserSchema = {
    body: z.object({
        email: z.string().email(),
        password: z.string().min(6),
        full_name: z.string().min(2),
        role: z.enum(['user', 'admin']).optional()
    })
};

exports.updateUserSchema = {
    body: z.object({
        email: z.string().email().optional(),
        password: z.string().min(6).optional().or(z.literal('')), // Allow empty if not changing
        full_name: z.string().min(2).optional(),
        role: z.enum(['user', 'admin']).optional()
    })
};

exports.grantSubscriptionSchema = {
    body: z.object({
        email: z.string().email(),
        planId: z.string().min(1),
        durationInDays: z.number().int().positive().optional().default(30)
    })
};

exports.revokeSubscriptionSchema = {
    body: z.object({
        subscriptionId: z.string().uuid()
    })
};

exports.createPlanSchema = {
    body: z.object({
        name: z.string().min(2),
        price: z.number().positive(),
        duration_days: z.number().int().positive()
    })
};

exports.updatePlanSchema = {
    body: z.object({
        name: z.string().min(2).optional(),
        price: z.number().positive().optional(),
        duration_days: z.number().int().positive().optional(),
        is_active: z.boolean().optional()
    })
};
