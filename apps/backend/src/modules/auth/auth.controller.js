const authService = require('./auth.service');
const userRepository = require('../user/user.repository');
const { sendResponse } = require('../../utils/responseHelper');
const { isProduction, refreshTokenTtlDays } = require('../../config/env');

/**
 * Auth HTTP layer.
 *
 * The refresh token travels in an httpOnly cookie so client-side JavaScript
 * cannot read it, which limits the damage from an XSS bug. The access token is
 * returned in the response body for the Authorization header, matching how the
 * existing frontend already talks to this API.
 */

const REFRESH_COOKIE = 'refresh_token';

// Scoped to the auth routes so the cookie is not attached to every API call.
const cookieOptions = () => ({
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: refreshTokenTtlDays * 24 * 60 * 60 * 1000,
});

const requestContext = (req) => ({
    userAgent: req.get('user-agent'),
    ipAddress: req.ip,
});

/** Shape a user row for API responses (snake_case DB -> camelCase API). */
const presentUser = (user) => ({
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    avatarUrl: user.avatar_url,
    role: user.role,
    telegramUserId: user.telegram_user_id ? String(user.telegram_user_id) : null,
    telegramUsername: user.telegram_username,
    emailVerified: user.email_verified,
    createdAt: user.created_at,
});

function issueSession(res, { user, accessToken, refreshToken }, status, message) {
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions());
    return sendResponse(res, status, true, message, {
        user: presentUser(user),
        accessToken,
    });
}

exports.register = async (req, res, next) => {
    try {
        const result = await authService.register(req.body, requestContext(req));
        return issueSession(res, result, 201, 'Account created');
    } catch (error) {
        return next(error);
    }
};

exports.login = async (req, res, next) => {
    try {
        const result = await authService.login(req.body, requestContext(req));
        return issueSession(res, result, 200, 'Signed in');
    } catch (error) {
        return next(error);
    }
};

exports.telegramLogin = async (req, res, next) => {
    try {
        const result = await authService.telegramLogin(req.body, requestContext(req));
        return issueSession(res, result, 200, 'Signed in with Telegram');
    } catch (error) {
        return next(error);
    }
};

exports.linkTelegram = async (req, res, next) => {
    try {
        const user = await authService.linkTelegramToUser(req.user.id, req.body);
        return sendResponse(res, 200, true, 'Telegram account linked', presentUser(user));
    } catch (error) {
        return next(error);
    }
};

exports.refresh = async (req, res, next) => {
    try {
        const result = await authService.refresh(
            { refreshToken: req.cookies?.[REFRESH_COOKIE] },
            requestContext(req)
        );
        return issueSession(res, result, 200, 'Session refreshed');
    } catch (error) {
        // Clear the cookie so a doomed token is not replayed on every request.
        res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(), maxAge: undefined });
        return next(error);
    }
};

exports.logout = async (req, res, next) => {
    try {
        await authService.logout({ refreshToken: req.cookies?.[REFRESH_COOKIE] });
        res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(), maxAge: undefined });
        return sendResponse(res, 200, true, 'Signed out');
    } catch (error) {
        return next(error);
    }
};

exports.getProfile = async (req, res, next) => {
    try {
        const user = await userRepository.findById(req.user.id);
        if (!user) {
            return sendResponse(res, 404, false, 'User not found', null, { code: 'NOT_FOUND' });
        }
        return sendResponse(res, 200, true, 'User profile retrieved', presentUser(user));
    } catch (error) {
        return next(error);
    }
};

exports.changePassword = async (req, res, next) => {
    try {
        await authService.changePassword(req.user.id, req.body);
        res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(), maxAge: undefined });
        return sendResponse(res, 200, true, 'Password updated. Please sign in again.');
    } catch (error) {
        return next(error);
    }
};

exports.presentUser = presentUser;
exports.REFRESH_COOKIE = REFRESH_COOKIE;
