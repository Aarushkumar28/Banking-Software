const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: [true, 'Account ID is required'],
    },
    type: {
      type: String,
      enum: ['debit', 'credit'],
      required: [true, 'Transaction type is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than zero'],
    },
    balanceAfter: {
      type: Number,
      required: [true, 'Balance after transaction is required'],
    },
    relatedAccount: {
      type: String,
      required: [true, 'Related account number or identifier is required'],
      trim: true,
    },
    description: {
      type: String,
      default: 'General Transaction',
      trim: true,
    },
    flagged: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
      immutable: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes: transactions{accountId: 1}, compound with createdAt for fast ledger querying
transactionSchema.index({ accountId: 1, createdAt: -1 });

// Immutability Enforcement: block all update & delete operations
const blockMutation = function (next) {
  const error = new Error('Immutable Ledger Violation: Transactions cannot be modified or deleted.');
  error.statusCode = 403;
  error.errorCode = 'TRANSACTION_IMMUTABLE';
  return next(error);
};

transactionSchema.pre('updateOne', blockMutation);
transactionSchema.pre('updateMany', blockMutation);
transactionSchema.pre('findOneAndUpdate', blockMutation);
transactionSchema.pre('replaceOne', blockMutation);
transactionSchema.pre('findOneAndReplace', blockMutation);
transactionSchema.pre('deleteOne', blockMutation);
transactionSchema.pre('deleteMany', blockMutation);
transactionSchema.pre('findOneAndDelete', blockMutation);

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
