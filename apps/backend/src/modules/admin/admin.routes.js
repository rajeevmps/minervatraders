const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const { requireAuth } = require('../../middlewares/auth.middleware'); // New JWT Auth
const { adminOnly } = require('../../middlewares/admin.middleware');

// All routes here are protected and admin-only
router.use(requireAuth);
router.use(adminOnly);

// Dashboard
router.get('/stats', adminController.getStats);
router.get('/audit', adminController.getAuditLogs);

const validate = require('../../middlewares/validate');
const { createUserSchema, updateUserSchema, grantSubscriptionSchema, revokeSubscriptionSchema, createPlanSchema, updatePlanSchema } = require('./admin.schema');

// User Management
router.get('/users', adminController.getUsers);
router.post('/users', validate(createUserSchema), adminController.createUser);
router.put('/users/:id', validate(updateUserSchema), adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

// Subscription Plans
router.get('/plans', adminController.getPlans);
router.post('/plans', validate(createPlanSchema), adminController.createPlan);
router.put('/plans/:id', validate(updatePlanSchema), adminController.updatePlan);
router.delete('/plans/:id', adminController.deletePlan); // Soft Delete

// Subscription Management (Actions)
router.get('/subscriptions', adminController.getSubscriptions);
router.post('/subscriptions/grant', validate(grantSubscriptionSchema), adminController.grantSubscription);
router.post('/subscriptions/revoke', validate(revokeSubscriptionSchema), adminController.revokeSubscription);

// Webhook Inspector
router.get('/webhooks', adminController.getWebhooks);

// Payments & Export
router.get('/payments', adminController.getPayments);
router.get('/export/:type', adminController.exportData);

// Legacy / Generic Views
router.get('/tables', adminController.getTables);
router.get('/tables/:tableName', adminController.getTableData);

module.exports = router;
