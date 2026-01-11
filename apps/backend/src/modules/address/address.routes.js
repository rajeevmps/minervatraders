const express = require('express');
const router = express.Router();
const addressController = require('./address.controller');
const { protect } = require('../../middlewares/auth.middleware');

router.get('/', protect, addressController.getAddresses);
router.post('/add', protect, addressController.addAddress);
router.put('/:id', protect, addressController.updateAddress);
router.delete('/:id', protect, addressController.deleteAddress);

module.exports = router;
