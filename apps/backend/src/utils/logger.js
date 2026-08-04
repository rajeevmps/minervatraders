const winston = require('winston');

const isProduction = process.env.NODE_ENV === 'production';

// Always log to stdout/stderr. Container and PaaS filesystems are ephemeral, so
// file transports silently discard production logs — the console transport is
// what the platform's log collector actually reads.
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: isProduction
                ? winston.format.json()
                : winston.format.combine(winston.format.colorize(), winston.format.simple()),
        }),
    ],
    silent: process.env.NODE_ENV === 'test',
});

module.exports = logger;
