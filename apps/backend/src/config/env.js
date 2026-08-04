const path = require('path');
const dotenv = require('dotenv');
const { z } = require('zod');

// Load .env from the backend root (src/config -> src -> backend root).
// Absent in production, where the platform injects real environment variables.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Secrets and integration credentials are mandatory in production but optional
 * locally, so a fresh clone boots without a full credential set. Anything the
 * app cannot function without at all (database, token secrets) is always required.
 */
const requiredInProduction = (schema) => (isProduction ? schema : schema.optional());

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(5000),
    FRONTEND_URL: z.string().url().default('http://localhost:3000'),

    // Postgres
    DATABASE_URL: z
        .string()
        .min(1)
        .refine((v) => v.startsWith('postgres://') || v.startsWith('postgresql://'), {
            message: 'must be a postgres:// or postgresql:// connection string',
        }),
    DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),

    // Auth. Two distinct secrets so a leaked access secret cannot mint refresh tokens.
    JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'must be at least 32 characters'),
    ACCESS_TOKEN_TTL: z.string().default('15m'),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

    // Razorpay
    RAZORPAY_KEY_ID: requiredInProduction(z.string().min(1)),
    RAZORPAY_KEY_SECRET: requiredInProduction(z.string().min(1)),
    RAZORPAY_WEBHOOK_SECRET: requiredInProduction(z.string().min(1)),

    // Telegram. The bot token doubles as the HMAC key for Login Widget verification.
    TELEGRAM_BOT_TOKEN: requiredInProduction(z.string().min(1)),
    TELEGRAM_CHANNEL_ID: requiredInProduction(z.string().min(1)),
    TELEGRAM_WEBHOOK_SECRET: requiredInProduction(z.string().min(1)),
});

// A key present but blank (`FOO=` in a .env file) means "not configured", not
// "configured as empty string". Dropping blanks lets .optional() and .default()
// behave as intended.
const rawEnv = Object.fromEntries(
    Object.entries(process.env).filter(([, value]) => value !== undefined && value !== '')
);

const parsed = envSchema.safeParse(rawEnv);

if (!parsed.success) {
    const issues = parsed.error.issues
        .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('\n');
    // Fail fast and loudly. A half-configured process that boots is far worse
    // than one that refuses to, because the failure surfaces as runtime 500s.
    // console, not the logger: the logger itself depends on this module.
    // eslint-disable-next-line no-console
    console.error(`Invalid environment configuration:\n${issues}`);
    throw new Error('Environment validation failed');
}

const env = parsed.data;

module.exports = {
    env,
    isProduction,

    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    frontendUrl: env.FRONTEND_URL,

    databaseUrl: env.DATABASE_URL,
    databasePoolMax: env.DATABASE_POOL_MAX,

    jwtAccessSecret: env.JWT_ACCESS_SECRET,
    jwtRefreshSecret: env.JWT_REFRESH_SECRET,
    accessTokenTtl: env.ACCESS_TOKEN_TTL,
    refreshTokenTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
    bcryptRounds: env.BCRYPT_ROUNDS,

    razorpayKeyId: env.RAZORPAY_KEY_ID,
    razorpayKeySecret: env.RAZORPAY_KEY_SECRET,
    razorpayWebhookSecret: env.RAZORPAY_WEBHOOK_SECRET,

    telegramBotToken: env.TELEGRAM_BOT_TOKEN,
    telegramChannelId: env.TELEGRAM_CHANNEL_ID,
    telegramWebhookSecret: env.TELEGRAM_WEBHOOK_SECRET,
};
