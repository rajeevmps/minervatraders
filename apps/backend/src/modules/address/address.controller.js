const addressService = require('./address.service');

exports.getAddresses = async (req, res, next) => {
    try {
        const addresses = await addressService.getAddress(req.user.id);
        res.status(200).json(addresses);
    } catch (error) {
        next(error);
    }
};

exports.addAddress = async (req, res, next) => {
    try {
        const address = await addressService.addAddress(req.user.id, req.body);
        res.status(201).json(address);
    } catch (error) {
        next(error);
    }
};

exports.updateAddress = async (req, res, next) => {
    try {
        const address = await addressService.updateAddress(req.user.id, req.params.id, req.body);
        res.status(200).json(address);
    } catch (error) {
        next(error);
    }
};

exports.deleteAddress = async (req, res, next) => {
    try {
        await addressService.deleteAddress(req.user.id, req.params.id);
        res.status(200).json({ message: 'Address removed' });
    } catch (error) {
        next(error);
    }
};
