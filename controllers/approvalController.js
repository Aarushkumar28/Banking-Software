const { Account, Approval, Transaction } = require('../models');
const { sendSuccess, AppError } = require('../utils/apiResponse');

/**
 * Module 2: Account Approval Workflow.
 * Staff/Admin only: approves or rejects a pending bank account.
 * Logs decision in the `approvals` collection and blocks re-approval of already decided accounts.
 */
const decideAccount = async (req, res, next) => {
  try {
    const { id } = req.params;
    const rawDecision = req.body.decision || req.body.status;
    const decision = rawDecision ? String(rawDecision).toLowerCase() : null;
    const { remarks } = req.body;

    const account = await Account.findById(id);
    if (!account) {
      throw new AppError('Bank account not found.', 404, 'ACCOUNT_NOT_FOUND');
    }

    // Module 2 Business Rule: Block re-approval of already-decided accounts (HTTP 409 Conflict)
    if (account.status !== 'pending') {
      throw new AppError(
        `Account has already been decided with status '${account.status}'. Re-approval is prohibited.`,
        409,
        'ACCOUNT_ALREADY_DECIDED'
      );
    }

    // Record decision in approvals collection
    const approvalRecord = await Approval.create({
      accountId: account._id,
      staffId: req.user.id,
      decision,
      remarks: remarks || '',
      createdAt: new Date(),
    });

    // Update account status based on decision
    const newStatus = decision === 'approved' ? 'active' : 'rejected';
    account.status = newStatus;
    await account.save();

    // If account is approved and has an initial deposit, record initial deposit in transaction ledger
    if (decision === 'approved' && account.balance > 0) {
      await Transaction.create({
        accountId: account._id,
        type: 'credit',
        amount: account.balance,
        balanceAfter: account.balance,
        relatedAccount: 'INITIAL_DEPOSIT',
        description: 'Account Opening Initial Deposit',
        flagged: false,
        createdAt: new Date(),
      });
    }

    return sendSuccess(
      res,
      200,
      `Account has been successfully ${decision}.`,
      {
        account: {
          id: account._id,
          accountNumber: account.accountNumber,
          status: account.status,
          balance: account.balance,
        },
        approval: approvalRecord,
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get approval history for a specific account.
 */
const getAccountApprovals = async (req, res, next) => {
  try {
    const { id } = req.params;
    const approvals = await Approval.find({ accountId: id })
      .populate('staffId', 'name email role')
      .sort({ createdAt: -1 });

    return sendSuccess(res, 200, 'Approval history retrieved successfully.', { approvals });
  } catch (error) {
    next(error);
  }
};

/**
 * Module 12: List all accounts currently pending approval (Staff dashboard).
 */
const getPendingApprovals = async (req, res, next) => {
  try {
    const pendingAccounts = await Account.find({ status: 'pending' })
      .populate('userId', 'name email kycStatus')
      .sort({ createdAt: 1 });

    return sendSuccess(res, 200, 'Pending accounts awaiting approval retrieved successfully.', {
      count: pendingAccounts.length,
      accounts: pendingAccounts,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  decideAccount,
  getAccountApprovals,
  getPendingApprovals,
};
