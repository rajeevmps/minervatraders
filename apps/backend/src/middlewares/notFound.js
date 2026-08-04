const { sendResponse } = require('../utils/responseHelper');

/**
 * Catch-all for unmatched routes.
 *
 * Without this Express falls back to its own HTML error page, so a mistyped API
 * path returned markup rather than the JSON envelope every client expects.
 */
const notFoundHandler = (req, res) =>
    sendResponse(res, 404, false, `Route not found: ${req.method} ${req.originalUrl}`, null, {
        code: 'ROUTE_NOT_FOUND',
    });

module.exports = notFoundHandler;
