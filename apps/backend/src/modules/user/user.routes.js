const express = require('express');
const router = express.Router();
const userController = require('./user.controller');
const { protect } = require('../../middlewares/auth.middleware');

router.get('/profile', protect, userController.getProfile);

module.exports = router;
