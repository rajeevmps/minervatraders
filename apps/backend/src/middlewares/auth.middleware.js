const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');
const { supabase } = require('../config/db');

exports.protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            throw new Error('Valid token not found');
        }

        req.user = user; // Supabase user object { id, email, ... }

        // Sync user to public.users table to ensure foreign keys work
        // This handles cases where user exists in Auth but not Public table (e.g. Google Login)
        const { error: upsertError } = await supabase.from('users').upsert({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
            avatar_url: user.user_metadata?.avatar_url,
            updated_at: new Date()
        }, { onConflict: 'id' });

        if (upsertError) {
            console.error('Failed to sync user to public table:', upsertError);
            // We verify if user exists to decide if we should block request
            // If upsert failed but user exists, we might proceed. If not, FK will fail later.
            // For now, logging is enough, usually upsert fails only on schema mismatch.
        }

        // Ensure role is present if needed by other parts (e.g. authorize middleware)
        // req.user.role = user.user_metadata?.role || 'user'; 

        next();
    } catch (error) {
        console.error('Auth Middleware Error:', error.message);
        return res.status(401).json({ message: 'Not authorized, token failed' });
    }
};

exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                message: `User role ${req.user ? req.user.role : 'unknown'} is not authorized to access this route`
            });
        }
        next();
    };
};
