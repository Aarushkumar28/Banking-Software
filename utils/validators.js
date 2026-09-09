const Joi = require('joi');

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const customObjectId = (value, helpers) => {
  if (!objectIdPattern.test(value)) {
    return helpers.message('Invalid ID format');
  }
  return value;
};

const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    'string.empty': 'Name is required',
    'string.min': 'Name must be at least 2 characters long',
  }),
  email: Joi.string().trim().email().lowercase().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Please provide a valid email address',
  }),
  password: Joi.string().min(6).max(128).required().messages({
    'string.empty': 'Password is required',
    'string.min': 'Password must be at least 6 characters long',
  }),
  role: Joi.string().valid('customer').default('customer'),
  kycDetails: Joi.object({
    documentType: Joi.string().valid('passport', 'national_id', 'driving_license', 'pan_card').default('national_id'),
    documentNumber: Joi.string().trim().min(4).max(50).required(),
    phone: Joi.string().trim().pattern(/^[+0-9\s-]{8,20}$/).required().messages({
      'string.pattern.base': 'Please provide a valid phone number',
    }),
    address: Joi.string().trim().min(5).max(255).required(),
  }).optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().trim().email().lowercase().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Please provide a valid email address',
  }),
  password: Joi.string().required().messages({
    'string.empty': 'Password is required',
  }),
});

const createStaffSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().trim().email().lowercase().required(),
  password: Joi.string().min(6).max(128).required(),
  role: Joi.string().valid('staff', 'admin').default('staff').required(),
});

const updateKycStatusSchema = Joi.object({
  kycStatus: Joi.string().valid('approved', 'rejected', 'pending').required(),
  remarks: Joi.string().trim().max(500).allow('', null).optional(),
});

const createAccountSchema = Joi.object({
  type: Joi.string().valid('savings', 'current').required().messages({
    'any.only': 'Account type must be either savings or current',
  }),
  initialDeposit: Joi.number().min(0).default(0).messages({
    'number.min': 'Initial deposit cannot be negative',
  }),
  dailyTransferLimit: Joi.number().positive().min(1000).optional(),
  minBalance: Joi.number().min(0).optional(),
});

const accountApprovalSchema = Joi.object({
  decision: Joi.string().insensitive().valid('approved', 'rejected').optional(),
  status: Joi.string().insensitive().valid('approved', 'rejected').optional(),
  remarks: Joi.string().trim().max(500).allow('', null).optional(),
}).or('decision', 'status').messages({
  'object.missing': 'Approval decision or status is required (approved or rejected)',
});

const accountStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'frozen').required().messages({
    'any.only': 'Status must be active or frozen',
  }),
  reason: Joi.string().trim().max(500).allow('', null).optional(),
});

const createBeneficiarySchema = Joi.object({
  accountId: Joi.string().custom(customObjectId).required().messages({
    'any.required': 'Source accountId is required',
  }),
  beneficiaryAccountNumber: Joi.string().trim().min(8).max(20).required().messages({
    'any.required': 'Beneficiary account number is required',
  }),
  nickname: Joi.string().trim().min(2).max(50).required().messages({
    'any.required': 'Nickname is required',
  }),
  beneficiaryName: Joi.string().trim().min(2).max(100).required().messages({
    'any.required': 'Beneficiary name is required',
  }),
});

const transferSchema = Joi.object({
  sourceAccountId: Joi.string().custom(customObjectId).required().messages({
    'any.required': 'Source account ID is required',
  }),
  destinationAccountNumber: Joi.string().trim().required().messages({
    'any.required': 'Destination account number is required',
  }),
  amount: Joi.number().positive().min(1).required().messages({
    'number.positive': 'Transfer amount must be greater than 0',
    'any.required': 'Transfer amount is required',
  }),
  description: Joi.string().trim().max(200).allow('', null).default('Fund Transfer').optional(),
});

const statementQuerySchema = Joi.object({
  from: Joi.date().iso().optional().messages({
    'date.format': 'from date must be an ISO 8601 date string (YYYY-MM-DD)',
  }),
  to: Joi.date().iso().min(Joi.ref('from')).optional().messages({
    'date.format': 'to date must be an ISO 8601 date string (YYYY-MM-DD)',
    'date.min': 'to date cannot be earlier than from date',
  }),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const interestCalculationSchema = Joi.object({
  annualRate: Joi.number().min(0.001).max(0.5).optional(),
  periodDays: Joi.number().integer().min(1).max(365).default(30),
});

module.exports = {
  customObjectId,
  registerSchema,
  loginSchema,
  createStaffSchema,
  updateKycStatusSchema,
  createAccountSchema,
  accountApprovalSchema,
  accountStatusSchema,
  createBeneficiarySchema,
  transferSchema,
  statementQuerySchema,
  interestCalculationSchema,
};
