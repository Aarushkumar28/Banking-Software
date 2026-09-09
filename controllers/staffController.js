const { Account, Transaction, User, Approval } = require('../models');
const { runWithTransaction } = require('../utils/transactionSessionHelper');
const { sendSuccess, AppError } = require('../utils/apiResponse');
const env = require('../config/env');

/**
 * Module 10: Freeze a bank account (Staff/Admin only).
 * Frozen accounts reject all transfer attempts with 403 Forbidden.
 */
const freezeAccount = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    const account = await Account.findById(id);
    if (!account) {
      throw new AppError('Bank account not found.', 404, 'ACCOUNT_NOT_FOUND');
    }

    if (account.status === 'frozen') {
      throw new AppError('Account is already frozen.', 409, 'ACCOUNT_ALREADY_FROZEN');
    }

    if (account.status === 'rejected') {
      throw new AppError('Cannot freeze a rejected account.', 409, 'INVALID_ACCOUNT_STATE');
    }

    account.status = 'frozen';
    await account.save();

    return sendSuccess(res, 200, 'Account has been successfully frozen.', {
      account: {
        id: account._id,
        accountNumber: account.accountNumber,
        status: account.status,
        reason: reason || 'Administrative freeze',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Module 10: Unfreeze a bank account (Staff/Admin only).
 */
const unfreezeAccount = async (req, res, next) => {
  try {
    const { id } = req.params;

    const account = await Account.findById(id);
    if (!account) {
      throw new AppError('Bank account not found.', 404, 'ACCOUNT_NOT_FOUND');
    }

    if (account.status !== 'frozen') {
      throw new AppError(
        `Cannot unfreeze account with status '${account.status}'. Account must be 'frozen'.`,
        409,
        'ACCOUNT_NOT_FROZEN'
      );
    }

    account.status = 'active';
    await account.save();

    return sendSuccess(res, 200, 'Account has been successfully unfrozen and is now active.', {
      account: {
        id: account._id,
        accountNumber: account.accountNumber,
        status: account.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Module 11: Interest Calculation Job Logic
 * Computes simple interest on active savings accounts and posts it as an immutable credit ledger entry.
 */
const calculateSavingsInterest = async (req, res, next) => {
  try {
    const annualRate = req.body?.annualRate !== undefined
      ? Number(req.body.annualRate)
      : env.SAVINGS_ANNUAL_INTEREST_RATE;
    const periodDays = req.body?.periodDays ? Number(req.body.periodDays) : 30;

    // Find all active savings accounts with positive balance
    const accounts = await Account.find({
      type: 'savings',
      status: 'active',
      balance: { $gt: 0 },
    });

    const results = [];
    let totalInterestCredited = 0;

    for (const account of accounts) {
      // Simple interest formula: P * (R * T / 365)
      const rawInterest = account.balance * (annualRate * (periodDays / 365));
      const interestAmount = Number(rawInterest.toFixed(2));

      if (interestAmount >= 0.01) {
        // Execute atomic credit and ledger post
        // eslint-disable-next-line no-loop-func
        await runWithTransaction(async (session) => {
          const opts = session ? { session } : {};
          const currentAcc = session
            ? await Account.findById(account._id).session(session)
            : await Account.findById(account._id);

          currentAcc.balance = Number((currentAcc.balance + interestAmount).toFixed(2));
          await currentAcc.save(opts);

          const transaction = new Transaction({
            accountId: currentAcc._id,
            type: 'credit',
            amount: interestAmount,
            balanceAfter: currentAcc.balance,
            relatedAccount: 'SYSTEM_INTEREST',
            description: `Savings Interest Credited for ${periodDays} days @ ${(annualRate * 100).toFixed(2)}% p.a.`,
            flagged: false,
            createdAt: new Date(),
          });
          await transaction.save(opts);
        });

        totalInterestCredited += interestAmount;
        results.push({
          accountId: account._id,
          accountNumber: account.accountNumber,
          previousBalance: account.balance,
          interestCredited: interestAmount,
          newBalance: Number((account.balance + interestAmount).toFixed(2)),
        });
      }
    }

    return sendSuccess(res, 200, 'Interest calculation job executed successfully.', {
      summary: {
        accountsProcessed: accounts.length,
        accountsCredited: results.length,
        annualRateUsed: annualRate,
        periodDays,
        totalInterestCredited: Number(totalInterestCredited.toFixed(2)),
      },
      credits: results,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Module 12: Staff Monitoring Dashboard - Flagged Transactions
 * Lists all transactions that breached the suspicious threshold.
 */
const getFlaggedTransactions = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const total = await Transaction.countDocuments({ flagged: true });
    const transactions = await Transaction.find({ flagged: true })
      .populate({
        path: 'accountId',
        select: 'accountNumber type status userId',
        populate: {
          path: 'userId',
          select: 'name email kycStatus',
        },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return sendSuccess(res, 200, 'Flagged transactions retrieved for monitoring.', {
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      transactions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Module 12: Staff Monitoring Dashboard - Overall Bank Statistics
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const [
      totalAccounts,
      activeAccounts,
      pendingAccounts,
      frozenAccounts,
      flaggedTransactionsCount,
      pendingKycUsersCount,
      totalBalanceAggregation,
    ] = await Promise.all([
      Account.countDocuments(),
      Account.countDocuments({ status: 'active' }),
      Account.countDocuments({ status: 'pending' }),
      Account.countDocuments({ status: 'frozen' }),
      Transaction.countDocuments({ flagged: true }),
      User.countDocuments({ role: 'customer', kycStatus: 'pending' }),
      Account.aggregate([
        { $group: { _id: null, totalDeposits: { $sum: '$balance' } } },
      ]),
    ]);

    const stats = {
      accounts: {
        total: totalAccounts,
        active: activeAccounts,
        pending: pendingAccounts,
        frozen: frozenAccounts,
      },
      kyc: {
        pendingCustomers: pendingKycUsersCount,
      },
      risk: {
        flaggedTransactions: flaggedTransactionsCount,
      },
      financials: {
        totalSystemDeposits: totalBalanceAggregation[0]?.totalDeposits || 0,
      },
    };

    return sendSuccess(res, 200, 'Staff dashboard statistics retrieved successfully.', { stats });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  freezeAccount,
  unfreezeAccount,
  calculateSavingsInterest,
  getFlaggedTransactions,
  getDashboardStats,
};
