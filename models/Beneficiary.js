const mongoose = require('mongoose');

const beneficiarySchema = new mongoose.Schema(
  {
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: [true, 'Account ID is required'],
      index: true,
    },
    beneficiaryAccountNumber: {
      type: String,
      required: [true, 'Beneficiary account number is required'],
      trim: true,
    },
    nickname: {
      type: String,
      required: [true, 'Nickname is required'],
      trim: true,
      maxlength: 50,
    },
    beneficiaryName: {
      type: String,
      required: [true, 'Beneficiary full name is required'],
      trim: true,
      maxlength: 100,
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

// Compound index ensures an account cannot add the same beneficiary account number twice
beneficiarySchema.index({ accountId: 1, beneficiaryAccountNumber: 1 }, { unique: true });

const Beneficiary = mongoose.model('Beneficiary', beneficiarySchema);

module.exports = Beneficiary;
