const { Account, Transaction } = require('../models');
const { runWithTransaction } = require('../utils/transactionSessionHelper');
const { sendSuccess, AppError } = require('../utils/apiResponse');
const env = require('../config/env');

/**
 * Module 5, 8, 9: Fund Transfer Engine
 * - Ownership & active status verification
 * - Minimum balance checking
 * - Daily transfer limit aggregation & enforcement
 * - Suspicious transaction threshold auto-flagging
 * - Atomic debit + credit ledger creation
 */
const transferFunds = async (req, res, next) => {
  try {
    const { sourceAccountId, destinationAccountNumber, amount, description } = req.body;

    // 1. Fetch and validate source account
    const sourceAccount = await Account.findById(sourceAccountId);
    if (!sourceAccount) {
      throw new AppError('Source bank account not found.', 404, 'SOURCE_ACCOUNT_NOT_FOUND');
    }

    // Customer ownership verification
    if (req.user.role === 'customer' && sourceAccount.userId.toString() !== req.user.id) {
      throw new AppError(
        'Access denied: You do not have permission to transfer funds from this account.',
        403,
        'RESOURCE_OWNERSHIP_DENIED'
      );
    }

    // Module 10: Frozen accounts reject all transfer attempts with 403
    if (sourceAccount.status === 'frozen') {
      throw new AppError(
        'Account is frozen. All debit and transfer operations are strictly prohibited.',
        403,
        'ACCOUNT_FROZEN'
      );
    }

    if (sourceAccount.status !== 'active') {
      throw new AppError(
        `Transfer rejected: Source account status is '${sourceAccount.status}'. Account must be 'active'.`,
        409,
        'ACCOUNT_NOT_ACTIVE'
      );
    }

    // 2. Fetch and validate destination account
    const destinationAccount = await Account.findOne({ accountNumber: destinationAccountNumber });
    if (!destinationAccount) {
      throw new AppError(
        `Destination account '${destinationAccountNumber}' not found in the banking system.`,
        404,
        'DESTINATION_ACCOUNT_NOT_FOUND'
      );
    }

    if (sourceAccount.accountNumber === destinationAccount.accountNumber) {
      throw new AppError(
        'Transfer rejected: Cannot transfer funds to the same source account.',
        409,
        'SELF_TRANSFER_CONFLICT'
      );
    }

    if (destinationAccount.status === 'frozen') {
      throw new AppError(
        'Transfer rejected: Destination account is currently frozen.',
        403,
        'DESTINATION_ACCOUNT_FROZEN'
      );
    }

    if (destinationAccount.status !== 'active') {
      throw new AppError(
        `Transfer rejected: Destination account status is '${destinationAccount.status}'.`,
        409,
        'DESTINATION_ACCOUNT_NOT_ACTIVE'
      );
    }

    // 3. Module 8: Minimum Balance Enforcement
    const projectedBalance = sourceAccount.balance - amount;
    if (projectedBalance < sourceAccount.minBalance) {
      throw new AppError(
        `Insufficient funds: Transfer of $${amount} would breach the required minimum balance of $${sourceAccount.minBalance}. Current balance is $${sourceAccount.balance}.`,
        409,
        'MINIMUM_BALANCE_BREACH'
      );
    }

    // 4. Module 8: Daily Transfer Limit Enforcement
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const dailyTransfersAggregation = await Transaction.aggregate([
      {
        $match: {
          accountId: sourceAccount._id,
          type: 'debit',
          createdAt: { $gte: startOfToday },
        },
      },
      {
        $group: {
          _id: null,
          totalDebitedToday: { $sum: '$amount' },
        },
      },
    ]);

    const debitedToday = dailyTransfersAggregation[0]?.totalDebitedToday || 0;
    const remainingLimit = sourceAccount.dailyTransferLimit - debitedToday;

    if (debitedToday + amount > sourceAccount.dailyTransferLimit) {
      throw new AppError(
        `Daily transfer limit breached: Attempted amount $${amount} exceeds remaining daily limit of $${Math.max(0, remainingLimit)}. Daily limit is $${sourceAccount.dailyTransferLimit}.`,
        409,
        'DAILY_LIMIT_EXCEEDED'
      );
    }

    // 5. Module 9: Suspicious Transaction Flagging
    const isSuspicious = amount >= env.SUSPICIOUS_THRESHOLD;

    // 6. Module 5 & 6: Atomic Debit + Credit Operation using Mongoose Transaction
    const transferResult = await runWithTransaction(async (session) => {
      const opts = session ? { session } : {};

      // Re-fetch with session lock if session exists
      const currentSource = session
        ? await Account.findById(sourceAccount._id).session(session)
        : await Account.findById(sourceAccount._id);

      const currentDestination = session
        ? await Account.findById(destinationAccount._id).session(session)
        : await Account.findById(destinationAccount._id);

      if (currentSource.balance - amount < currentSource.minBalance) {
        throw new AppError(
          'Insufficient funds during transaction execution.',
          409,
          'MINIMUM_BALANCE_BREACH'
        );
      }

      // Execute balance updates
      currentSource.balance -= amount;
      await currentSource.save(opts);

      currentDestination.balance += amount;
      await currentDestination.save(opts);

      // Create immutable debit record on source
      const debitRecord = new Transaction({
        accountId: currentSource._id,
        type: 'debit',
        amount,
        balanceAfter: currentSource.balance,
        relatedAccount: currentDestination.accountNumber,
        description: description || `Transfer to A/C ${currentDestination.accountNumber}`,
        flagged: isSuspicious,
        createdAt: new Date(),
      });
      await debitRecord.save(opts);

      // Create immutable credit record on destination
      const creditRecord = new Transaction({
        accountId: currentDestination._id,
        type: 'credit',
        amount,
        balanceAfter: currentDestination.balance,
        relatedAccount: currentSource.accountNumber,
        description: description || `Transfer from A/C ${currentSource.accountNumber}`,
        flagged: isSuspicious,
        createdAt: new Date(),
      });
      await creditRecord.save(opts);

      return {
        debitRecord,
        creditRecord,
        newSourceBalance: currentSource.balance,
      };
    });

    return sendSuccess(
      res,
      201,
      isSuspicious
        ? 'Transfer completed successfully. Note: Transaction has been automatically flagged for compliance review.'
        : 'Fund transfer executed successfully.',
      {
        transfer: {
          sourceAccountNumber: sourceAccount.accountNumber,
          destinationAccountNumber: destinationAccount.accountNumber,
          amount,
          newBalance: transferResult.newSourceBalance,
          flagged: isSuspicious,
          debitTransactionId: transferResult.debitRecord._id,
          timestamp: transferResult.debitRecord.createdAt,
        },
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Module 6: Transaction Ledger
 * Immutable audit trail: fetch transaction history for an account.
 * (Zero update or delete endpoints exposed)
 */
const getAccountTransactions = async (req, res, next) => {
  try {
    const { accountId } = req.params;

    const account = await Account.findById(accountId);
    if (!account) {
      throw new AppError('Bank account not found.', 404, 'ACCOUNT_NOT_FOUND');
    }

    if (req.user.role === 'customer' && account.userId.toString() !== req.user.id) {
      throw new AppError('Access denied: You do not own this account.', 403, 'RESOURCE_OWNERSHIP_DENIED');
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const total = await Transaction.countDocuments({ accountId });
    const transactions = await Transaction.find({ accountId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return sendSuccess(res, 200, 'Transaction ledger retrieved successfully.', {
      accountNumber: account.accountNumber,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      transactions,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  transferFunds,
  getAccountTransactions,
};
