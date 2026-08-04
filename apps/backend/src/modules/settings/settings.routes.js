const express = require('express');
const { z } = require('zod');

const router = express.Router();
const settingsController = require('./settings.controller');
const validate = require('../../middlewares/validate');
const { requireAuth, requireAdmin } = require('../../middlewares/auth.middleware');

// Body is a flat map of setting -> value; settings.service whitelists keys, so
// this only needs to guard the outer shape.
const updateSettingsSchema = {
    body: z.record(z.string(), z.union([z.string(), z.null()]).optional()),
};

router.get('/', requireAuth, requireAdmin, settingsController.getSettings);
router.post('/', requireAuth, requireAdmin, validate(updateSettingsSchema), settingsController.updateSettings);

module.exports = router;
