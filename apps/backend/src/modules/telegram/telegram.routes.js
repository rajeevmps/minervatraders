const express = require('express');
const router = express.Router();
const telegramController = require('./telegram.controller');
const { protect } = require('../../middlewares/auth.middleware');

const webhookController = require('./webhook.controller');

router.get('/invite', protect, telegramController.getInviteLink);
router.post('/webhook', webhookController.handleTelegramWebhook);

module.exports = router;
