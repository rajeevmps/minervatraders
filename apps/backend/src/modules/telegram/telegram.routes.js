const express = require('express');

const router = express.Router();
const telegramController = require('./telegram.controller');
const webhookController = require('./webhook.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');
const { verifyTelegramWebhook } = require('../../middlewares/telegramWebhook.middleware');

router.get('/invite', requireAuth, telegramController.getInviteLink);
router.get('/status', requireAuth, telegramController.getLinkStatus);

// Authenticated by Telegram's secret-token header, not by a user session.
router.post('/webhook', verifyTelegramWebhook, webhookController.handleTelegramWebhook);

module.exports = router;
