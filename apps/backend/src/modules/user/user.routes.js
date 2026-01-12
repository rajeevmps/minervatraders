const express = require('express');
const router = express.Router();
const userController = require('./user.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');

// No validation schema needed for getProfile as it relies on auth token
router.get('/profile', requireAuth, userController.getProfile);

module.exports = router;
