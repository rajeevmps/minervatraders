const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { adminOnly } = require('../../middlewares/admin.middleware');

// All routes here are protected and admin-only
router.use(protect);
router.use(adminOnly);

// Dashboard
router.get('/stats', adminController.getStats);

// User Management
router.get('/users', adminController.getUsers);
router.post('/users', adminController.createUser);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

// Subscription Plans
router.get('/plans', adminController.getPlans);
router.post('/plans', adminController.createPlan);
router.put('/plans/:id', adminController.updatePlan);
router.delete('/plans/:id', adminController.deletePlan); // Soft Delete

// Subscription Management (Actions)
router.get('/subscriptions', adminController.getSubscriptions);
router.post('/subscriptions/grant', adminController.grantSubscription);
router.post('/subscriptions/revoke', adminController.revokeSubscription);

// Payments & Export
router.get('/payments', adminController.getPayments);
router.get('/export/:type', adminController.exportData);

// Legacy / Generic Views
router.get('/tables', adminController.getTables);
router.get('/tables/:tableName', adminController.getTableData);

module.exports = router;
