const { Account, User, Transaction } = require('../models');
const { generateAccountNumber } = require('../utils/accountNumberGenerator');
const { sendSuccess, AppError } = require('../utils/apiResponse');

/**
 * Module 3: Create a new bank account (savings or current).
 * Allowed ONLY for KYC-approved customers.
 * Account starts in 'pending' status awaiting bank staff approval.
 */
const createAccount = async (req, res, next) => {
  try {
    const { type, initialDeposit, dailyTransferLimit, minBalance } = req.body;

    // Check user KYC verification status
    const user = await User.findById(req.user.id);
    if (!user) {
      throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    }

    if (user.kycStatus !== 'approved') {
      throw new AppError(
        `Account creation rejected: Customer KYC status is '${user.kycStatus}'. Only KYC-approved customers can open accounts.`,
        403,
        'KYC_APPROVAL_REQUIRED'
      );
    }

    // Generate a unique 10-digit account number
    let accountNumber;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      accountNumber = generateAccountNumber(type);
      const existing = await Account.findOne({ accountNumber });
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      throw new AppError('Failed to generate unique account number. Please retry.', 500, 'ACCOUNT_NUMBER_GENERATION_FAILED');
    }

    const accountData = {
      userId: req.user.id,
      accountNumber,
      type,
      balance: initialDeposit || 0,
      status: 'pending', // Pending staff approval workflow
    };

    if (dailyTransferLimit !== undefined) {
      accountData.dailyTransferLimit = dailyTransferLimit;
    }

    if (minBalance !== undefined) {
      accountData.minBalance = minBalance;
    }

    const account = await Account.create(accountData);

    return sendSuccess(res, 201, 'Bank account created successfully. It is currently pending staff approval.', {
      account: {
        id: account._id,
        accountNumber: account.accountNumber,
        type: account.type,
        balance: account.balance,
        status: account.status,
        minBalance: account.minBalance,
        dailyTransferLimit: account.dailyTransferLimit,
        createdAt: account.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Module 3: List accounts.
 * For customers: returns their own accounts.
 * For staff/admin: returns all accounts with optional query filters.
 */
const getAccounts = async (req, res, next) => {
  try {
    const query = {};

    if (req.user.role === 'customer') {
      query.userId = req.user.id;
    } else {
      if (req.query.userId) query.userId = req.query.userId;
      if (req.query.status) query.status = req.query.status;
      if (req.query.type) query.type = req.query.type;
    }

    const accounts = await Account.find(query)
      .populate('userId', 'name email kycStatus')
      .sort({ createdAt: -1 });

    return sendSuccess(res, 200, 'Accounts retrieved successfully.', {
      count: accounts.length,
      accounts,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Module 3: Get single account details by ID.
 * Ownership verified by requireAccountOwnership middleware.
 */
const getAccountById = async (req, res, next) => {
  try {
    // req.account is pre-loaded by requireAccountOwnership middleware
    const account = await Account.findById(req.params.id).populate('userId', 'name email kycStatus role');

    if (!account) {
      throw new AppError('Bank account not found.', 404, 'ACCOUNT_NOT_FOUND');
    }

    return sendSuccess(res, 200, 'Account details retrieved successfully.', { account });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove/Dismiss a rejected or pending account application.
 */
const deleteAccount = async (req, res, next) => {
  try {
    const account = await Account.findById(req.params.id);
    if (!account) {
      throw new AppError('Bank account not found.', 404, 'ACCOUNT_NOT_FOUND');
    }

    // Ownership check (unless admin)
    if (req.user.role !== 'admin' && account.userId.toString() !== req.user.id) {
      throw new AppError('Access denied: You do not own this account.', 403, 'FORBIDDEN');
    }

    // Only allow removing rejected or pending accounts
    if (account.status !== 'rejected' && account.status !== 'pending') {
      throw new AppError('Only rejected or pending account applications can be removed.', 400, 'CANNOT_DELETE_ACTIVE_ACCOUNT');
    }

    await Account.findByIdAndDelete(req.params.id);

    return sendSuccess(res, 200, 'Account application removed successfully.', {
      accountId: req.params.id,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk clear all rejected accounts for the current user.
 */
const clearRejectedAccounts = async (req, res, next) => {
  try {
    const filter = { userId: req.user.id, status: 'rejected' };
    const result = await Account.deleteMany(filter);

    return sendSuccess(res, 200, `Removed ${result.deletedCount} rejected account application(s).`, {
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAccount,
  getAccounts,
  getAccountById,
  deleteAccount,
  clearRejectedAccounts,
};
