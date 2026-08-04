const settingsService = require('./settings.service');
const telegramService = require('../telegram/telegram.service');
const { sendResponse } = require('../../utils/responseHelper');

exports.getSettings = async (req, res, next) => {
    try {
        const settings = await settingsService.getSettings();
        return sendResponse(res, 200, true, 'Settings retrieved', settings);
    } catch (error) {
        return next(error);
    }
};

exports.updateSettings = async (req, res, next) => {
    try {
        const result = await settingsService.updateSettings(req.body);

        // The Telegram service caches these for 10 minutes; without this the
        // admin would change the channel and see no effect until the TTL lapsed.
        telegramService.invalidateConfigCache();

        return sendResponse(res, 200, true, 'Settings updated', result);
    } catch (error) {
        return next(error);
    }
};

exports.allowedKeys = (req, res) =>
    sendResponse(res, 200, true, 'Allowed setting keys', settingsService.ALLOWED_KEYS);
