const userService = require('./user.service');
const { sendResponse } = require('../../utils/responseHelper');

exports.getProfile = async (req, res, next) => {
    try {
        // req.user.sub is the Supabase User ID from the JWT
        const user = await userService.getUserById(req.user.sub);

        if (!user) {
            return sendResponse(res, 404, false, 'User not found', null, { code: 'USER_NOT_FOUND' });
        }

        return sendResponse(res, 200, true, 'User profile retrieved', user);
    } catch (error) {
        // Pass to global error handler, or handle here if we want to be consistent immediately
        // For now, let's use our helper to be consistent with the task
        return sendResponse(res, 500, false, 'Error retrieving user profile', null, { code: 'USER_PROFILE_ERROR', details: error.message });
    }
};
