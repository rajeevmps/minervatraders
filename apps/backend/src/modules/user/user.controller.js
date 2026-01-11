const userService = require('./user.service');

exports.getProfile = async (req, res, next) => {
    try {
        const user = await userService.getUserById(req.user.id);
        res.status(200).json(user);
    } catch (error) {
        next(error);
    }
};
