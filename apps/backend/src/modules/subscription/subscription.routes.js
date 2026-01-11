const express = require('express');
const router = express.Router();
const subscriptionController = require('./subscription.controller');
const { protect } = require('../../middlewares/auth.middleware');

router.get('/plans', subscriptionController.getPlans);
router.get('/', protect, subscriptionController.getSubscriptions);

module.exports = router;
