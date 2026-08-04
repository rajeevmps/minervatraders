/**
 * Runs BEFORE any module is imported (jest `setupFiles`).
 *
 * config/env.js loads .env via dotenv, and dotenv does not overwrite variables
 * that are already set — so assigning them here wins, and the suite can never
 * accidentally point at the development database.
 */

process.env.NODE_ENV = 'test';

process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ||
    'postgresql://postgres:postgres@127.0.0.1:5433/minerva_test';

// Distinct from any real secret, and long enough to satisfy the 32-char rule.
process.env.JWT_ACCESS_SECRET = 'test-access-secret-do-not-use-in-production-0001';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-do-not-use-in-production-002';
process.env.ACCESS_TOKEN_TTL = '15m';
process.env.REFRESH_TOKEN_TTL_DAYS = '30';

// Lowest permitted cost. bcrypt at 12 rounds makes a large suite crawl.
process.env.BCRYPT_ROUNDS = '10';

process.env.TELEGRAM_BOT_TOKEN = '123456789:TEST-BOT-TOKEN-FOR-HMAC-CHECKS';
process.env.TELEGRAM_CHANNEL_ID = '-1001234567890';
process.env.TELEGRAM_WEBHOOK_SECRET = 'test-telegram-webhook-secret';

process.env.RAZORPAY_KEY_ID = 'rzp_test_fake';
process.env.RAZORPAY_KEY_SECRET = 'rzp_test_fake_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'rzp_test_webhook_secret';
