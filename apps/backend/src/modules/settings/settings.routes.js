const express = require('express');
const router = express.Router();
const settingsController = require('./settings.controller');
const { requireAuth, requireAdmin } = require('../../middlewares/auth.middleware');

// Protected: Admin only
router.get('/', requireAuth, requireAdmin, settingsController.getSettings);
router.post('/', requireAuth, requireAdmin, settingsController.updateSettings);

module.exports = router;
