const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');
const statementController = require('../controllers/statementController');
const approvalController = require('../controllers/approvalController');
const staffController = require('../controllers/staffController');
const { authenticate, authorize, requireAccountOwnership } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createAccountSchema, statementQuerySchema, accountApprovalSchema } = require('../utils/validators');

// Module 3: Create account (Customer only, KYC approved)
router.post(
  '/',
  authenticate,
  authorize('customer'),
  validate(createAccountSchema, 'body'),
  accountController.createAccount
);

// Module 3: List accounts (Customer views own; Staff/Admin views all)
router.get('/', authenticate, accountController.getAccounts);

// Module 3: Get single account details (Ownership-checked)
router.get(
  '/:id',
  authenticate,
  requireAccountOwnership,
  accountController.getAccountById
);

// Module 2: Staff approves/rejects account (supports PUT /api/accounts/:id/approve and POST /api/accounts/:id/approval)
router.put(
  '/:id/approve',
  authenticate,
  authorize('staff', 'admin'),
  validate(accountApprovalSchema, 'body'),
  approvalController.decideAccount
);
router.post(
  '/:id/approval',
  authenticate,
  authorize('staff', 'admin'),
  validate(accountApprovalSchema, 'body'),
  approvalController.decideAccount
);

// Module 10: Staff freezes/unfreezes account (supports PUT /api/accounts/:id/freeze and PATCH /api/accounts/:id/freeze)
router.put(
  '/:id/freeze',
  authenticate,
  authorize('staff', 'admin'),
  staffController.freezeAccount
);
router.patch(
  '/:id/freeze',
  authenticate,
  authorize('staff', 'admin'),
  staffController.freezeAccount
);
router.put(
  '/:id/unfreeze',
  authenticate,
  authorize('staff', 'admin'),
  staffController.unfreezeAccount
);
router.patch(
  '/:id/unfreeze',
  authenticate,
  authorize('staff', 'admin'),
  staffController.unfreezeAccount
);

// Module 7: Account Statement Generation (Ownership-checked)
router.get(
  '/:id/statement',
  authenticate,
  requireAccountOwnership,
  validate(statementQuerySchema, 'query'),
  statementController.getAccountStatement
);

// Module 2: View account approval history (Ownership-checked)
router.get(
  '/:id/approvals',
  authenticate,
  requireAccountOwnership,
  approvalController.getAccountApprovals
);

// Clear all rejected accounts for authenticated customer
router.delete('/rejected/clear', authenticate, accountController.clearRejectedAccounts);

// Remove single rejected account application (Ownership-checked)
router.delete('/:id', authenticate, accountController.deleteAccount);

module.exports = router;
