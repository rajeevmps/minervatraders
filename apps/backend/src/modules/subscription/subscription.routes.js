const express = require('express');

const router = express.Router();
const subscriptionController = require('./subscription.controller');
const validate = require('../../middlewares/validate');
const { idParam } = require('../../utils/validators');
const { requireAuth } = require('../../middlewares/auth.middleware');

// Public: the pricing page needs plans before sign-in.
router.get('/plans', subscriptionController.getPlans);

router.get('/', requireAuth, subscriptionController.getSubscriptions);
router.get('/history', requireAuth, subscriptionController.getHistory);
router.post(
    '/:id/cancel',
    requireAuth,
    validate({ params: idParam }),
    subscriptionController.cancelSubscription
);

module.exports = router;
