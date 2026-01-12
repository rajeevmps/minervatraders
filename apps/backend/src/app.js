const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');

const app = express();

// Enable trust proxy for Railway/Heroku load balancers
app.set('trust proxy', 1);

// 1. Security Headers
app.use(helmet());

// 2. Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api', limiter);

// 3. HTTP Parameter Pollution Protection
app.use(hpp());

// 4. CORS (Development friendly)
const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://localhost:5000'
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        // Relaxed for development: Allow ngrok and local origins
        if (process.env.NODE_ENV !== 'production' || allowedOrigins.indexOf(origin) !== -1 || origin.includes('ngrok-free.app')) {
            return callback(null, true);
        }

        const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
        return callback(new Error(msg), false);
    },
    credentials: true
}));

app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date() });
});

const cronService = require('./modules/cron/cron.service');

// Initialize Cron Jobs
cronService.initCronJobs();

// Routes
app.use('/api/v1', routes);

// Global Error Handler (Must be last)
app.use(errorHandler);

module.exports = app;
