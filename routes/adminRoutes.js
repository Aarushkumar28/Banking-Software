const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createStaffSchema, updateKycStatusSchema } = require('../utils/validators');

// Restrict entire router to Admin role
router.use(authenticate, authorize('admin'));

// Module 13: Create Staff or Admin accounts
router.post(
  '/staff',
  validate(createStaffSchema, 'body'),
  adminController.createStaffUser
);

// Module 13: List all system users
router.get('/users', adminController.getAllUsers);

// Module 13: Update user role
router.patch('/users/:id/role', adminController.updateUserRole);

// Module 13: Update KYC status
router.patch(
  '/users/:id/kyc',
  validate(updateKycStatusSchema, 'body'),
  adminController.updateUserKycStatus
);

module.exports = router;
