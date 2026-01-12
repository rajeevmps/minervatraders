const { supabase } = require('../config/db');

exports.adminOnly = async (req, res, next) => {
    try {
        // req.user is populated by requireAuth (JWT)
        // JWT standard field for user ID is 'sub'
        const userId = req.user?.sub || req.user?.id;

        if (!userId) {
            return res.status(401).json({ message: 'Not authorized, user ID missing' });
        }

        // Check against dedicated admins table
        const { data, error } = await supabase
            .from('admins')
            .select('user_id')
            .eq('user_id', userId)
            .single();

        if (error || !data) {
            console.error('Admin Access Attempt Denied:', userId);
            return res.status(403).json({ message: 'Access denied: Insufficient privileges' });
        }

        // Additional Safety: Attach full admin record if needed
        req.admin = data;
        next();
    } catch (error) {
        console.error('Admin Middleware Error:', error.message);
        return res.status(500).json({ message: 'Server error during admin check' });
    }
};
