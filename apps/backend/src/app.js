const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');

const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const notFoundHandler = require('./middlewares/notFound');
const db = require('./config/db');
const logger = require('./utils/logger');
const { frontendUrl, isProduction } = require('./config/env');

const app = express();

// Trust exactly one proxy hop (the platform load balancer) so req.ip reflects
// the real client and rate limiting is not applied to the proxy's address.
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet());

// Global ceiling. Credential and payment routes add their own tighter limits.
app.use(
    '/api',
    rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 300,
        standardHeaders: true,
        legacyHeaders: false,
        skip: () => process.env.NODE_ENV === 'test' && process.env.ENABLE_RATE_LIMIT !== 'true',
        message: { success: false, message: 'Too many requests, please try again later.' },
    })
);

app.use(hpp());

/**
 * CORS.
 *
 * The previous configuration allowed ANY origin whenever NODE_ENV !== production
 * and, in every environment, any *.ngrok-free.app host — with credentials
 * enabled. Now the allow-list applies consistently and extra dev origins are
 * opt-in via CORS_EXTRA_ORIGINS.
 */
const allowedOrigins = new Set(
    [
        frontendUrl,
        'https://minervatraders.in',
        'https://www.minervatraders.in',
        ...(isProduction ? [] : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000']),
        ...(process.env.CORS_EXTRA_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean),
    ].filter(Boolean)
);

app.use(
    cors({
        origin: (origin, callback) => {
            // Same-origin and non-browser clients (curl, server-to-server) send
            // no Origin header at all.
            if (!origin) return callback(null, true);
            if (allowedOrigins.has(origin)) return callback(null, true);

            logger.warn('Blocked cross-origin request', { origin });
            return callback(new Error('Not allowed by CORS'), false);
        },
        credentials: true,
    })
);

app.use(cookieParser());

// The raw body is retained for Razorpay's HMAC, which must be computed over the
// exact bytes received rather than a re-serialised object.
app.use(
    express.json({
        limit: '100kb',
        verify: (req, res, buf) => {
            req.rawBody = buf;
        },
    })
);
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

/** Liveness: the process is up. Never touches the database. */
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

/** Readiness: the process can actually serve traffic. */
app.get('/ready', async (req, res) => {
    try {
        const detail = await db.healthCheck();
        return res.status(200).json({ status: 'ready', database: 'up', ...detail });
    } catch (error) {
        // Previously /health returned 200 regardless of database state, so an
        // instance with a dead connection pool still looked healthy.
        return res.status(503).json({ status: 'unavailable', database: 'down' });
    }
});

app.use('/api/v1', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
