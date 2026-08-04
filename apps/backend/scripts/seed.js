#!/usr/bin/env node
/**
 * Idempotent seed: subscription plans + an initial admin account.
 *
 * Safe to run repeatedly — every write is an upsert keyed on a natural key.
 * Replaces the six ad-hoc Supabase admin scripts.
 *
 *   npm run seed --workspace=backend
 *
 * Admin credentials come from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
 * Outside development a password must be supplied explicitly.
 */

const bcrypt = require('bcryptjs');
const db = require('../src/config/db');
const { bcryptRounds, isProduction } = require('../src/config/env');

const PLANS = [
    { name: 'Monthly', price: 3000, durationDays: 30, sortOrder: 1 },
    { name: 'Quarterly', price: 8000, durationDays: 90, sortOrder: 2 },
    { name: 'Yearly', price: 28000, durationDays: 365, sortOrder: 3 },
];

async function seedPlans() {
    for (const plan of PLANS) {
        // Name is the natural key; ON CONFLICT keeps pricing edits from being
        // reverted by a later seed run.
        await db.query(
            `INSERT INTO subscription_plans (name, price, duration_days, sort_order)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (name) DO UPDATE
                SET duration_days = EXCLUDED.duration_days,
                    sort_order    = EXCLUDED.sort_order`,
            [plan.name, plan.price, plan.durationDays, plan.sortOrder]
        );
    }
    console.log(`Seeded ${PLANS.length} subscription plans.`);
}

async function seedAdmin() {
    const email = process.env.SEED_ADMIN_EMAIL || 'admin@minervatraders.com';
    const password = process.env.SEED_ADMIN_PASSWORD;

    if (!password && isProduction) {
        throw new Error('SEED_ADMIN_PASSWORD is required when NODE_ENV=production');
    }

    const effectivePassword = password || 'ChangeMe!2026';
    const passwordHash = await bcrypt.hash(effectivePassword, bcryptRounds);

    const admin = await db.one(
        `INSERT INTO users (email, password_hash, full_name, role, email_verified)
         VALUES ($1, $2, $3, 'admin', TRUE)
         ON CONFLICT (email) DO UPDATE
            SET role = 'admin', email_verified = TRUE
         RETURNING id, email, role`,
        [email, passwordHash, 'Platform Admin']
    );

    console.log(`Seeded admin ${admin.email} (${admin.role}).`);
    if (!password) {
        console.warn(
            `\n  WARNING: no SEED_ADMIN_PASSWORD set — used the default development password.\n` +
                `  Change it before exposing this environment.\n`
        );
    }
}

async function main() {
    await db.connectDB();
    await seedPlans();
    await seedAdmin();
    console.log('\nSeed complete.');
}

main()
    .catch((err) => {
        console.error('Seed failed:', err.message);
        process.exitCode = 1;
    })
    .finally(() => db.close());
