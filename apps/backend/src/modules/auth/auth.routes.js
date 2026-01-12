const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');

// Protected Routes
router.get('/me', requireAuth, authController.getProfile);

// Sync Route (Called upon login/callback)
router.post('/sync', authController.syncUser);

module.exports = router;
