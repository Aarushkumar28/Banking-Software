const { Account, Transaction } = require('../models');
const { sendSuccess, AppError } = require('../utils/apiResponse');

/**
 * Module 7: Account Statement Generation
 * Generates an official bank account statement for a specified date range,
 * calculating opening balance, total debits, total credits, closing balance,
 * and listing all ledger items.
 */
const getAccountStatement = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { from, to, page = 1, limit = 50 } = req.query;

    const account = await Account.findById(id);
    if (!account) {
      throw new AppError('Bank account not found.', 404, 'ACCOUNT_NOT_FOUND');
    }

    // Customer ownership verification
    if (req.user.role === 'customer' && account.userId.toString() !== req.user.id) {
      throw new AppError(
        'Access denied: You do not have permission to view statements for this account.',
        403,
        'RESOURCE_OWNERSHIP_DENIED'
      );
    }

    // Build date filters
    const filter = { accountId: account._id };
    const dateQuery = {};

    if (from) {
      dateQuery.$gte = new Date(from);
    }
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      dateQuery.$lte = toDate;
    }

    if (Object.keys(dateQuery).length > 0) {
      filter.createdAt = dateQuery;
    }

    // Calculate opening balance if `from` date is supplied
    let openingBalance = 0;
    if (from) {
      const priorTransactions = await Transaction.aggregate([
        {
          $match: {
            accountId: account._id,
            createdAt: { $lt: new Date(from) },
          },
        },
        {
          $group: {
            _id: null,
            totalCredit: {
              $sum: {
                $cond: [{ $eq: ['$type', 'credit'] }, '$amount', 0],
              },
            },
            totalDebit: {
              $sum: {
                $cond: [{ $eq: ['$type', 'debit'] }, '$amount', 0],
              },
            },
          },
        },
      ]);

      if (priorTransactions.length > 0) {
        openingBalance = (priorTransactions[0].totalCredit || 0) - (priorTransactions[0].totalDebit || 0);
      }
    }

    // Compute period totals for this date range
    const periodSummary = await Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalDebits: {
            $sum: {
              $cond: [{ $eq: ['$type', 'debit'] }, '$amount', 0],
            },
          },
          totalCredits: {
            $sum: {
              $cond: [{ $eq: ['$type', 'credit'] }, '$amount', 0],
            },
          },
          transactionCount: { $sum: 1 },
        },
      },
    ]);

    const totalDebits = periodSummary[0]?.totalDebits || 0;
    const totalCredits = periodSummary[0]?.totalCredits || 0;
    const totalTransactions = periodSummary[0]?.transactionCount || 0;

    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const statement = {
      account: {
        id: account._id,
        accountNumber: account.accountNumber,
        type: account.type,
        currentBalance: account.balance,
        minBalance: account.minBalance,
        status: account.status,
      },
      period: {
        from: from ? new Date(from).toISOString() : 'Account Inception',
        to: to ? new Date(to).toISOString() : new Date().toISOString(),
      },
      summary: {
        openingBalance: Number(openingBalance.toFixed(2)),
        totalCredits: Number(totalCredits.toFixed(2)),
        totalDebits: Number(totalDebits.toFixed(2)),
        netFlow: Number((totalCredits - totalDebits).toFixed(2)),
        currentBalance: Number(account.balance.toFixed(2)),
        totalTransactions,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalTransactions / limitNum) || 1,
      },
      transactions,
    };

    return sendSuccess(res, 200, 'Account statement generated successfully.', { statement });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAccountStatement,
};
