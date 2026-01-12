const jwt = require('jsonwebtoken');
const { supabaseJwtSecret } = require('../config/env');
const { supabase } = require('../config/db');

/**
 * Middleware to verify Supabase JWT and sync user to public table.
 * 1. Checks for Bearer token.
 * 2. Verifies token (Locally or via Supabase).
 * 3. Syncs user to public.users table (UPSERT) to ensure FK integrity.
 * 4. Attaches user to req.user.
 */
exports.requireAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            message: 'Authorization header missing or invalid',
            error: { code: 'AUTH_HEADER_MISSING' }
        });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Bearer token missing',
            error: { code: 'TOKEN_MISSING' }
        });
    }

    try {
        let user;

        // Strategy 1: Local Verification (Fast)
        if (supabaseJwtSecret) {
            try {
                const decoded = jwt.verify(token, supabaseJwtSecret);
                // Transform decoded JWT to match Supabase user shape if needed, 
                // but usually the important parts for us are 'sub', 'email', 'role'.
                user = {
                    id: decoded.sub,
                    email: decoded.email,
                    role: decoded.role,
                    user_metadata: decoded.user_metadata,
                    app_metadata: decoded.app_metadata
                };
            } catch (jwtError) {
                // If local verify fails (expired, etc.), we can try API or just fail.
                // Usually safe to just fail or let the fallback run if strictly needed.
                // For 'TokenExpiredError', we should definitely fail.
                if (jwtError.name === 'TokenExpiredError') {
                    throw jwtError;
                }
                // allow fallback
            }
        }

        // Strategy 2: Supabase API Verification (Fallback or Primary if no secret)
        if (!user) {
            const { data: { user: apiUser }, error } = await supabase.auth.getUser(token);
            if (error || !apiUser) {
                throw new Error('Invalid token');
            }
            user = apiUser;
        }

        // 3. User Sync (Critical for DB Consistency)
        // We sync on every request (or could optimize to only if missing locally, but upsert is safe)
        const { error: upsertError } = await supabase.from('users').upsert({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
            avatar_url: user.user_metadata?.avatar_url,
            updated_at: new Date()
        }, { onConflict: 'id' });

        if (upsertError) {
            console.error('CRITICAL: Failed to sync user to public.users:', upsertError);
            // We proceed, but note that calls requiring FK to public.users might fail.
        }

        req.user = {
            sub: user.id, // Standardize on 'sub' for consistency
            id: user.id,
            email: user.email,
            role: user.role, // 'authenticated' usually
            // We can also fetch the custom role from public.users if needed here
        };

        next();

    } catch (error) {
        // console.error('Auth Error:', error.message);
        const code = error.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
        return res.status(401).json({
            success: false,
            message: 'Not authorized',
            error: { code, details: error.message }
        });
    }
};

exports.authorize = (...roles) => {
    return (req, res, next) => {
        // This relies on the role being present on req.user. 
        // Note: Supabase JWT role is usually 'authenticated'. 
        // Real role usually lives in app_metadata or public.admins table.

        // Check for admin/special roles here if needed.
        // For now, we pass if any role matches or if no roles required.
        if (roles.length > 0 && !roles.includes(req.user.role)) {
            // Basic check failed. 
            // TODO: Implement DB-based role check for 'admin' if needed.
            // For now, return error.
            return res.status(403).json({
                message: `User role ${req.user.role} is not authorized`
            });
        }
        next();
    };
};
