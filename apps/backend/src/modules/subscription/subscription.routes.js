const express = require('express');
const router = express.Router();
const subscriptionController = require('./subscription.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');

router.get('/plans', subscriptionController.getPlans);
router.get('/', requireAuth, subscriptionController.getSubscriptions);

module.exports = router;
