const crypto = require('crypto');
const { telegramWebhookSecret, isProduction } = require('../config/env');
const logger = require('../utils/logger');

/**
 * Verify that a webhook delivery really came from Telegram.
 *
 * When the webhook is registered with a `secret_token`, Telegram echoes it in
 * the X-Telegram-Bot-Api-Secret-Token header on every delivery. Register with:
 *
 *   POST https://api.telegram.org/bot<TOKEN>/setWebhook
 *   { "url": "https://your.host/api/v1/telegram/webhook",
 *     "secret_token": "<TELEGRAM_WEBHOOK_SECRET>" }
 *
 * The endpoint previously had no authentication whatsoever, so anyone who knew
 * the URL could forge join-request approvals and account links.
 */
const verifyTelegramWebhook = (req, res, next) => {
    if (!telegramWebhookSecret) {
        // Refusing to run unauthenticated in production is safer than silently
        // accepting forged updates; locally it is merely inconvenient.
        if (isProduction) {
            logger.error('TELEGRAM_WEBHOOK_SECRET is not set; refusing webhook');
            return res.status(503).send('webhook not configured');
        }
        logger.warn('TELEGRAM_WEBHOOK_SECRET not set — webhook signature check skipped');
        return next();
    }

    const provided = req.get('x-telegram-bot-api-secret-token') || '';

    if (!timingSafeEqual(provided, telegramWebhookSecret)) {
        logger.warn('Rejected Telegram webhook with bad secret token', { ip: req.ip });
        // 401 rather than 200: this is not a real Telegram delivery, so there
        // is no retry loop to worry about.
        return res.status(401).send('unauthorized');
    }

    return next();
};

/** Constant-time string compare that does not leak length via early exit. */
function timingSafeEqual(a, b) {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) {
        // Still burn a comparison so timing does not reveal a length mismatch.
        crypto.timingSafeEqual(bufA, bufA);
        return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = { verifyTelegramWebhook };
