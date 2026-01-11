const { supabase } = require('../config/db');

exports.adminOnly = async (req, res, next) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: 'Not authorized, user not found' });
        }

        // Check against dedicated admins table
        const { data, error } = await supabase
            .from('admins')
            .select('user_id')
            .eq('user_id', req.user.id)
            .single();

        if (error || !data) {
            console.error('Admin Access Attempt Denied:', req.user.id);
            return res.status(403).json({ message: 'Access denied: Insufficient privileges' });
        }

        next();
    } catch (error) {
        console.error('Admin Middleware Error:', error.message);
        return res.status(500).json({ message: 'Server error during admin check' });
    }
};
