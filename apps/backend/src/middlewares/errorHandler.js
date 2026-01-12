const { sendResponse } = require('../utils/responseHelper');

/**
 * Global Error Handler Middleware
 * Captures all unhandled errors and returns a standardized API response.
 */
const logger = require('../utils/logger');

/**
 * Global Error Handler Middleware
 * Captures all unhandled errors and returns a standardized API response.
 */
const errorHandler = (err, req, res, next) => {
    // Log the error for debugging
    logger.error(`${err.statusCode || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);

    if (process.env.NODE_ENV === 'development') {
        logger.error(err.stack);
    }

    // Default to 500 Internal Server Error
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    const errorDetails = process.env.NODE_ENV === 'development' ? err.stack : undefined;
    const errorCode = err.code || 'INTERNAL_ERROR';

    return sendResponse(
        res,
        statusCode,
        false,
        message,
        null, // No data
        {
            code: errorCode,
            details: errorDetails
        }
    );
};

module.exports = errorHandler;
