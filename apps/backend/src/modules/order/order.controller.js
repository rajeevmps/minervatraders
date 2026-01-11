const orderService = require('./order.service');

exports.getOrders = async (req, res, next) => {
    try {
        const orders = await orderService.getOrders(req.user.id);
        res.status(200).json(orders);
    } catch (error) {
        next(error);
    }
};

exports.getOrderById = async (req, res, next) => {
    try {
        const order = await orderService.getOrderById(req.user.id, req.params.id);
        if (!order) return res.status(404).json({ message: 'Order not found' });
        res.status(200).json(order);
    } catch (error) {
        next(error);
    }
};
