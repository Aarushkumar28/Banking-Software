const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const approvalController = require('../controllers/approvalController');
const adminController = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  accountApprovalSchema,
  updateKycStatusSchema,
  interestCalculationSchema,
} = require('../utils/validators');

// Restrict entire router to Staff and Admin roles
router.use(authenticate, authorize('staff', 'admin'));

// Module 2: Account Approval Workflow
router.post(
  '/accounts/:id/approval',
  validate(accountApprovalSchema, 'body'),
  approvalController.decideAccount
);

// Module 10: Account Freeze/Unfreeze
router.patch('/accounts/:id/freeze', staffController.freezeAccount);
router.patch('/accounts/:id/unfreeze', staffController.unfreezeAccount);

// Module 12: Staff Monitoring Dashboard
router.get('/pending-approvals', approvalController.getPendingApprovals);
router.get('/flagged-transactions', staffController.getFlaggedTransactions);
router.get('/dashboard-stats', staffController.getDashboardStats);

// Module 11: Interest Calculation Job Execution
router.post(
  '/jobs/calculate-interest',
  validate(interestCalculationSchema, 'body'),
  staffController.calculateSavingsInterest
);

// Module 1 & 13: Customer KYC Verification Review
router.patch(
  '/users/:id/kyc',
  validate(updateKycStatusSchema, 'body'),
  adminController.updateUserKycStatus
);

module.exports = router;
