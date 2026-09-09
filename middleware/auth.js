const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { AppError } = require('../utils/apiResponse');
const { Account, User } = require('../models');

/**
 * Generates a signed JWT token with user identity and role.
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      kycStatus: user.kycStatus,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
};

/**
 * Authenticates requests via Bearer JWT in the Authorization header.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(
        'Authentication required. No Bearer token provided.',
        401,
        'AUTH_TOKEN_MISSING'
      );
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new AppError(
        'Authentication required. Token is empty.',
        401,
        'AUTH_TOKEN_EMPTY'
      );
    }

    const decoded = jwt.verify(token, env.JWT_SECRET);

    // Verify user still exists in database
    const user = await User.findById(decoded.userId).select('_id name email role kycStatus');
    if (!user) {
      throw new AppError(
        'User belonging to this token no longer exists.',
        401,
        'USER_NOT_FOUND'
      );
    }

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      kycStatus: user.kycStatus,
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Authorizes access based on allowed user roles (RBAC).
 * @param  {...string} allowedRoles - e.g. 'admin', 'staff', 'customer'
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(
        new AppError('Authentication required.', 401, 'UNAUTHENTICATED')
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          `Forbidden: Access denied. Required role: [${allowedRoles.join(', ')}]`,
          403,
          'FORBIDDEN_ROLE_ACCESS'
        )
      );
    }

    next();
  };
};

/**
 * Enforces resource ownership for bank accounts.
 * Bank staff and Admin have elevated visibility, but customers can only access their own accounts.
 */
const requireAccountOwnership = async (req, res, next) => {
  try {
    const accountId =
      req.params.id ||
      req.params.accountId ||
      req.body.sourceAccountId ||
      req.body.accountId;

    if (!accountId) {
      throw new AppError(
        'Account identifier is required for this operation.',
        400,
        'ACCOUNT_ID_REQUIRED'
      );
    }

    const account = await Account.findById(accountId);
    if (!account) {
      throw new AppError('Bank account not found.', 404, 'ACCOUNT_NOT_FOUND');
    }

    // Staff and Admin have regulatory oversight
    if (req.user.role === 'staff' || req.user.role === 'admin') {
      req.account = account;
      return next();
    }

    // For customers, check userId ownership
    if (account.userId.toString() !== req.user.id.toString()) {
      throw new AppError(
        'Access denied: You do not own this bank account.',
        403,
        'RESOURCE_OWNERSHIP_DENIED'
      );
    }

    req.account = account;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  generateToken,
  authenticate,
  authorize,
  requireAccountOwnership,
};
