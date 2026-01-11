const subscriptionService = require('./subscription.service');

exports.getSubscriptions = async (req, res, next) => {
    try {
        const sub = await subscriptionService.getActiveSubscription(req.user.id);
        if (!sub) return res.status(200).json({ message: 'No active subscription' });
        res.status(200).json(sub);
    } catch (error) {
        next(error);
    }
}


exports.getPlans = async (req, res, next) => {
    try {
        const plans = await subscriptionService.getAllPlans();
        res.status(200).json(plans);
    } catch (error) {
        next(error);
    }
};

// Manually create (mostly for admins or testing, real flow is via Webhook)
exports.createSubscription = async (req, res, next) => {
    try {
        const { planId } = req.body;
        // In real flow, verify payment first.
        const sub = await subscriptionService.createSubscription(req.user.id, planId, null);
        res.status(201).json(sub);
    } catch (error) {
        next(error);
    }
};
