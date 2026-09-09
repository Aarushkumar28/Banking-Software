const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { authenticate, requireAccountOwnership } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { transferSchema } = require('../utils/validators');

// Module 5, 8, 9: Fund Transfer Engine (Debit + Credit, atomic, limits & flagging enforced)
router.post(
  '/transfer',
  authenticate,
  validate(transferSchema, 'body'),
  transactionController.transferFunds
);

// Module 6: Transaction Ledger (Read-only, immutable)
router.get(
  '/account/:accountId',
  authenticate,
  requireAccountOwnership,
  transactionController.getAccountTransactions
);

module.exports = router;
