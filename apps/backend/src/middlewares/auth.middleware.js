const db = require('../config/db');
const tokenService = require('../modules/auth/token.service');
const { sendResponse } = require('../utils/responseHelper');

/**
 * Authentication and authorisation middleware.
 *
 * Replaces the Supabase JWT flow. Two behavioural fixes worth noting:
 *
 *   1. The old implementation swallowed every jwt.verify failure except
 *      expiry and fell through to a remote Supabase lookup — including
 *      BAD SIGNATURE. Verification is now strict: an invalid token is rejected.
 *   2. Admin status came from a separate `admins` table, queried by two
 *      near-identical middlewares (`requireAdmin` and `adminOnly`) and also
 *      read straight from the browser with the public anon key. It is now
 *      `users.role`, resolved server-side only.
 */

/** Verify the bearer access token and populate req.user. */
exports.requireAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return sendResponse(res, 401, false, 'Authorization header missing or invalid', null, {
            code: 'AUTH_HEADER_MISSING',
        });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
        return sendResponse(res, 401, false, 'Bearer token missing', null, {
            code: 'TOKEN_MISSING',
        });
    }

    try {
        const decoded = tokenService.verifyAccessToken(token);

        // Both `sub` and `id` are populated: controllers across the codebase
        // read one or the other, and they must stay interchangeable.
        req.user = {
            sub: decoded.sub,
            id: decoded.sub,
            email: decoded.email,
            role: decoded.role,
        };

        return next();
    } catch (error) {
        const code = error.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
        return sendResponse(res, 401, false, 'Not authorized', null, { code });
    }
};

/**
 * Require an admin.
 *
 * Re-reads the role from the database rather than trusting the token claim, so
 * revoking admin rights takes effect immediately instead of lingering for the
 * remainder of the access-token lifetime. Admin traffic is low volume, so the
 * extra query is a worthwhile trade for immediate revocation.
 */
exports.requireAdmin = async (req, res, next) => {
    if (!req.user || !req.user.id) {
        return sendResponse(res, 401, false, 'User not authenticated', null, {
            code: 'NOT_AUTHENTICATED',
        });
    }

    try {
        const row = await db.one(`SELECT role, is_active FROM users WHERE id = $1`, [req.user.id]);

        if (!row || !row.is_active || row.role !== 'admin') {
            return sendResponse(res, 403, false, 'Access denied: administrators only', null, {
                code: 'FORBIDDEN',
            });
        }

        req.user.role = row.role;
        return next();
    } catch (error) {
        return next(error);
    }
};

/**
 * Optional auth: populate req.user when a valid token is present, but never
 * reject. For endpoints that render differently for signed-in visitors.
 */
exports.optionalAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return next();

    try {
        const decoded = tokenService.verifyAccessToken(authHeader.slice('Bearer '.length).trim());
        req.user = {
            sub: decoded.sub,
            id: decoded.sub,
            email: decoded.email,
            role: decoded.role,
        };
    } catch {
        // A bad token on an optional route is simply treated as anonymous.
    }
    return next();
};

// `authorize(...roles)` previously existed here with zero call sites and an
// unimplemented TODO where its role lookup belonged. Use requireAdmin instead.
