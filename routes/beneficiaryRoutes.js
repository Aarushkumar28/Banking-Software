const express = require('express');
const router = express.Router();
const beneficiaryController = require('../controllers/beneficiaryController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createBeneficiarySchema } = require('../utils/validators');

// Module 4: Add beneficiary (Customer only, tied to own account)
router.post(
  '/',
  authenticate,
  authorize('customer'),
  validate(createBeneficiarySchema, 'body'),
  beneficiaryController.addBeneficiary
);

// Module 4: List beneficiaries
router.get('/', authenticate, beneficiaryController.getBeneficiaries);

// Module 4: Delete beneficiary
router.delete('/:id', authenticate, beneficiaryController.deleteBeneficiary);

module.exports = router;
