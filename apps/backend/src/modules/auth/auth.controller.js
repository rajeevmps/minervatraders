const authService = require('./auth.service');
const { sendResponse } = require('../../utils/responseHelper');

exports.getProfile = async (req, res) => {
    try {
        const user = req.user;
        const data = {
            id: user.sub,
            email: user.email,
            role: user.role,
        };
        return sendResponse(res, 200, true, 'User profile retrieved', data);
    } catch (error) {
        return sendResponse(res, 500, false, 'Error retrieving profile', null, { code: 'PROFILE_ERROR', details: error.message });
    }
};

exports.syncUser = async (req, res) => {
    try {
        const userData = req.body;
        const result = await authService.syncUser(userData);
        return sendResponse(res, 200, true, 'User synchronized successfully', result);
    } catch (error) {
        console.error('[AuthSync] Error:', error);
        return sendResponse(res, 500, false, 'Error synchronizing user', null, { code: 'SYNC_ERROR', details: error.message });
    }
};
