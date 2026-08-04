const express = require('express');

const router = express.Router();
const addressController = require('./address.controller');
const validate = require('../../middlewares/validate');
const schemas = require('./address.schema');
const { requireAuth } = require('../../middlewares/auth.middleware');

router.get('/', requireAuth, addressController.getAddresses);
router.post('/add', requireAuth, validate(schemas.createAddressSchema), addressController.addAddress);
router.put('/:id', requireAuth, validate(schemas.updateAddressSchema), addressController.updateAddress);
router.delete('/:id', requireAuth, validate(schemas.addressIdSchema), addressController.deleteAddress);

module.exports = router;
