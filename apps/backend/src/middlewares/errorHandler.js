const { sendResponse } = require('../utils/responseHelper');
const logger = require('../utils/logger');

/**
 * Terminal error handler.
 *
 * Translates thrown errors into the standard response envelope. Postgres error
 * codes are mapped to sensible HTTP statuses — with the Supabase client these
 * surfaced as `{ error }` objects that call sites inspected by hand.
 */

const PG_ERROR_MAP = {
    '23505': { status: 409, message: 'That record already exists', code: 'DUPLICATE' },
    '23503': { status: 409, message: 'Related record not found or still in use', code: 'FK_VIOLATION' },
    '23502': { status: 400, message: 'A required field is missing', code: 'NOT_NULL_VIOLATION' },
    '23514': { status: 400, message: 'A value failed a validation rule', code: 'CHECK_VIOLATION' },
    '22P02': { status: 400, message: 'Malformed value in request', code: 'INVALID_TEXT' },
    '42601': { status: 500, message: 'Internal query error', code: 'SYNTAX_ERROR' },
};

const errorHandler = (err, req, res, _next) => {
    const mapped = PG_ERROR_MAP[err.code];

    // AuthError and hand-thrown errors carry .status; Express convention is
    // .statusCode. Support both.
    const status = err.status || err.statusCode || mapped?.status || 500;
    const code = mapped?.code || err.code || 'INTERNAL_ERROR';

    // Never surface a raw database message to a client — it leaks schema
    // details. Application errors carry deliberately written messages.
    const message = mapped
        ? mapped.message
        : status < 500
          ? err.message
          : 'Internal Server Error';

    const logPayload = {
        status,
        code,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        error: err.message,
    };

    if (status >= 500) {
        logger.error('Request failed', { ...logPayload, stack: err.stack });
    } else {
        logger.warn('Request rejected', logPayload);
    }

    return sendResponse(res, status, false, message, null, {
        code,
        details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
};

module.exports = errorHandler;
