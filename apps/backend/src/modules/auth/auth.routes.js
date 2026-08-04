const express = require('express');
const rateLimit = require('express-rate-limit');

const router = express.Router();
const authController = require('./auth.controller');
const schemas = require('./auth.schema');
const validate = require('../../middlewares/validate');
const { requireAuth } = require('../../middlewares/auth.middleware');

/**
 * Credential endpoints get a far tighter budget than the global 100/15min API
 * limiter, which is nowhere near strict enough to slow password guessing.
 */
const credentialLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    // Successful sign-ins should not count toward the lockout budget.
    skipSuccessfulRequests: true,
    // The suite deliberately makes many failed attempts from one address; the
    // limiter itself is covered by a dedicated test that re-enables it.
    skip: () => process.env.NODE_ENV === 'test' && process.env.ENABLE_RATE_LIMIT !== 'true',
    message: { success: false, message: 'Too many attempts. Please try again later.' },
});

router.post('/register', credentialLimiter, validate(schemas.registerSchema), authController.register);
router.post('/login', credentialLimiter, validate(schemas.loginSchema), authController.login);
router.post('/telegram', credentialLimiter, validate(schemas.telegramLoginSchema), authController.telegramLogin);

// Rotation is cookie-driven; no body to validate.
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

router.get('/me', requireAuth, authController.getProfile);
router.post('/link-telegram', requireAuth, validate(schemas.telegramLoginSchema), authController.linkTelegram);
router.post('/change-password', requireAuth, validate(schemas.changePasswordSchema), authController.changePassword);

// POST /sync is intentionally gone: it was unauthenticated and wrote `role`
// straight from the request body.

module.exports = router;
