const express = require('express');
const router = express.Router();
const addressController = require('./address.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');

router.get('/', requireAuth, addressController.getAddresses);
router.post('/add', requireAuth, addressController.addAddress);
router.put('/:id', requireAuth, addressController.updateAddress);
router.delete('/:id', requireAuth, addressController.deleteAddress);

module.exports = router;
