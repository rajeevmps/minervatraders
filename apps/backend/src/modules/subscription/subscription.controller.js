const subscriptionService = require('./subscription.service');
const { sendResponse } = require('../../utils/responseHelper');

/**
 * Presenters map snake_case database columns to the camelCase shape declared in
 * @repo/types. Without this the API would be inconsistent — /auth/me already
 * returned camelCase while these endpoints leaked raw column names.
 */

const presentPlan = (plan) =>
    !plan
        ? null
        : {
              id: plan.id,
              name: plan.name,
              description: plan.description ?? null,
              price: plan.price,
              salePrice: plan.sale_price ?? null,
              currency: plan.currency,
              durationDays: plan.duration_days,
              isActive: plan.is_active,
          };

const presentSubscription = (subscription) =>
    !subscription
        ? null
        : {
              id: subscription.id,
              userId: subscription.user_id,
              planId: subscription.plan_id,
              status: subscription.status,
              startDate: subscription.start_date,
              endDate: subscription.end_date,
              plan: subscription.plan ? presentPlan(subscription.plan) : undefined,
          };

exports.getSubscriptions = async (req, res, next) => {
    try {
        const subscription = await subscriptionService.getActiveSubscription(req.user.id);
        return sendResponse(
            res,
            200,
            true,
            subscription ? 'Active subscription found' : 'No active subscription',
            presentSubscription(subscription)
        );
    } catch (error) {
        return next(error);
    }
};

exports.getHistory = async (req, res, next) => {
    try {
        const history = await subscriptionService.getSubscriptionHistory(req.user.id);
        return sendResponse(res, 200, true, 'Subscription history fetched', history.map(presentSubscription));
    } catch (error) {
        return next(error);
    }
};

exports.getPlans = async (req, res, next) => {
    try {
        const plans = await subscriptionService.getAllPlans();
        return sendResponse(res, 200, true, 'Plans fetched successfully', plans.map(presentPlan));
    } catch (error) {
        return next(error);
    }
};

exports.cancelSubscription = async (req, res, next) => {
    try {
        const cancelled = await subscriptionService.cancelSubscription(req.user.id, req.params.id);
        if (!cancelled) {
            return sendResponse(res, 404, false, 'No active subscription with that id', null, {
                code: 'NOT_FOUND',
            });
        }
        return sendResponse(res, 200, true, 'Subscription cancelled', presentSubscription(cancelled));
    } catch (error) {
        return next(error);
    }
};

// `createSubscription` is deliberately not exposed. It previously sat behind
// `requireAuth` only, so any signed-in user could POST a planId and grant
// themselves a paid subscription for free. Subscriptions are now created solely
// by the payment fulfilment path, or by an admin via /admin/subscriptions/grant.

exports.presentSubscription = presentSubscription;
exports.presentPlan = presentPlan;
