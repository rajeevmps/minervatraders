const express = require('express');

const router = express.Router();
const orderController = require('./order.controller');
const validate = require('../../middlewares/validate');
const { idParam } = require('../../utils/validators');
const { requireAuth } = require('../../middlewares/auth.middleware');

router.get('/', requireAuth, orderController.getOrders);
// Validating the id stops a malformed value reaching Postgres, where it would
// surface as a 22P02 invalid-uuid error rather than a clean 400.
router.get('/:id', requireAuth, validate({ params: idParam }), orderController.getOrderById);

module.exports = router;
