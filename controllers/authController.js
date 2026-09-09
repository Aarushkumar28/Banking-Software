const { User } = require('../models');
const { generateToken } = require('../middleware/auth');
const { sendSuccess, AppError } = require('../utils/apiResponse');

/**
 * Register a new customer with KYC information.
 * Newly registered customers start with kycStatus: 'pending'.
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, kycDetails } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError('An account with this email address already exists.', 409, 'EMAIL_ALREADY_EXISTS');
    }

    const passwordHash = await User.hashPassword(password);

    const user = await User.create({
      name,
      email,
      passwordHash,
      role: 'customer',
      kycStatus: 'pending',
      kycDetails: kycDetails || {},
    });

    const token = generateToken(user);

    return sendSuccess(res, 201, 'Customer registered successfully. KYC verification is pending review.', {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        kycStatus: user.kycStatus,
        kycDetails: user.kycDetails,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login user (customer, staff, or admin).
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    const token = generateToken(user);

    return sendSuccess(res, 200, 'Login successful.', {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        kycStatus: user.kycStatus,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Fetch authenticated user profile.
 */
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      throw new AppError('User profile not found.', 404, 'USER_NOT_FOUND');
    }

    return sendSuccess(res, 200, 'Profile retrieved successfully.', { user });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getProfile,
};
