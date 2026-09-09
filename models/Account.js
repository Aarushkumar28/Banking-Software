const mongoose = require('mongoose');
const env = require('../config/env');

const accountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Account owner userId is required'],
      index: true,
    },
    accountNumber: {
      type: String,
      required: [true, 'Account number is required'],
      unique: true,
      index: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['savings', 'current'],
      required: [true, 'Account type is required'],
      default: 'savings',
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Account balance cannot be negative'],
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'frozen', 'rejected'],
      default: 'pending',
      index: true,
    },
    dailyTransferLimit: {
      type: Number,
      default: function () {
        return this.type === 'current'
          ? env.DEFAULT_CURRENT_DAILY_LIMIT
          : env.DEFAULT_SAVINGS_DAILY_LIMIT;
      },
    },
    minBalance: {
      type: Number,
      default: function () {
        return this.type === 'current'
          ? env.DEFAULT_CURRENT_MIN_BALANCE
          : env.DEFAULT_SAVINGS_MIN_BALANCE;
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

const Account = mongoose.model('Account', accountSchema);

module.exports = Account;
