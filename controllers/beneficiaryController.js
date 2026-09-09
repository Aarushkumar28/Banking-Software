const { Beneficiary, Account } = require('../models');
const { sendSuccess, AppError } = require('../utils/apiResponse');

/**
 * Module 4: Add a beneficiary tied to customer's own account.
 */
const addBeneficiary = async (req, res, next) => {
  try {
    const { accountId, beneficiaryAccountNumber, nickname, beneficiaryName } = req.body;

    // Verify source account exists and user owns it
    const sourceAccount = await Account.findById(accountId);
    if (!sourceAccount) {
      throw new AppError('Source bank account not found.', 404, 'ACCOUNT_NOT_FOUND');
    }

    if (req.user.role === 'customer' && sourceAccount.userId.toString() !== req.user.id) {
      throw new AppError(
        'Access denied: You can only add beneficiaries to accounts you own.',
        403,
        'RESOURCE_OWNERSHIP_DENIED'
      );
    }

    // Check if customer is attempting to add their own account number
    if (sourceAccount.accountNumber === beneficiaryAccountNumber) {
      throw new AppError(
        'Cannot add your own account as a beneficiary.',
        409,
        'SELF_BENEFICIARY_CONFLICT'
      );
    }

    // Verify if destination account exists in the bank (optional check / metadata enrichment)
    const destinationAccount = await Account.findOne({ accountNumber: beneficiaryAccountNumber });
    if (!destinationAccount) {
      throw new AppError(
        `Beneficiary account number '${beneficiaryAccountNumber}' does not exist in the banking system.`,
        404,
        'BENEFICIARY_ACCOUNT_NOT_FOUND'
      );
    }

    // Check for existing duplicate beneficiary entry
    const existing = await Beneficiary.findOne({
      accountId,
      beneficiaryAccountNumber,
    });
    if (existing) {
      throw new AppError(
        'This beneficiary account number is already registered for this account.',
        409,
        'DUPLICATE_BENEFICIARY'
      );
    }

    const beneficiary = await Beneficiary.create({
      accountId,
      beneficiaryAccountNumber,
      nickname,
      beneficiaryName,
    });

    return sendSuccess(res, 201, 'Beneficiary registered successfully.', { beneficiary });
  } catch (error) {
    next(error);
  }
};

/**
 * Module 4: List beneficiaries tied to customer's account(s).
 */
const getBeneficiaries = async (req, res, next) => {
  try {
    const { accountId } = req.query;

    if (accountId) {
      const account = await Account.findById(accountId);
      if (!account) {
        throw new AppError('Bank account not found.', 404, 'ACCOUNT_NOT_FOUND');
      }

      if (req.user.role === 'customer' && account.userId.toString() !== req.user.id) {
        throw new AppError('Access denied: You do not own this account.', 403, 'RESOURCE_OWNERSHIP_DENIED');
      }

      const beneficiaries = await Beneficiary.find({ accountId }).sort({ createdAt: -1 });
      return sendSuccess(res, 200, 'Beneficiaries retrieved successfully.', { beneficiaries });
    }

    // If no specific accountId, return all beneficiaries across all accounts owned by user
    if (req.user.role === 'customer') {
      const userAccounts = await Account.find({ userId: req.user.id }).select('_id');
      const accountIds = userAccounts.map((acc) => acc._id);
      const beneficiaries = await Beneficiary.find({ accountId: { $in: accountIds } })
        .populate('accountId', 'accountNumber type')
        .sort({ createdAt: -1 });
      return sendSuccess(res, 200, 'Beneficiaries retrieved successfully.', { beneficiaries });
    }

    // Staff/Admin can view all beneficiaries
    const beneficiaries = await Beneficiary.find()
      .populate('accountId', 'accountNumber type userId')
      .sort({ createdAt: -1 });
    return sendSuccess(res, 200, 'All beneficiaries retrieved successfully.', { beneficiaries });
  } catch (error) {
    next(error);
  }
};

/**
 * Module 4: Remove a beneficiary tied to customer's own account.
 */
const deleteBeneficiary = async (req, res, next) => {
  try {
    const { id } = req.params;

    const beneficiary = await Beneficiary.findById(id);
    if (!beneficiary) {
      throw new AppError('Beneficiary record not found.', 404, 'BENEFICIARY_NOT_FOUND');
    }

    // Verify customer owns the parent account
    if (req.user.role === 'customer') {
      const parentAccount = await Account.findById(beneficiary.accountId);
      if (!parentAccount || parentAccount.userId.toString() !== req.user.id) {
        throw new AppError(
          'Access denied: You do not own the account associated with this beneficiary.',
          403,
          'RESOURCE_OWNERSHIP_DENIED'
        );
      }
    }

    await Beneficiary.findByIdAndDelete(id);

    return sendSuccess(res, 200, 'Beneficiary removed successfully.', { id });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addBeneficiary,
  getBeneficiaries,
  deleteBeneficiary,
};
