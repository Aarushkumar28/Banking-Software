const { User } = require('../models');
const { sendSuccess, AppError } = require('../utils/apiResponse');

/**
 * Module 13: Admin creates a bank staff or another admin account.
 */
const createStaffUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError('A user with this email address already exists.', 409, 'EMAIL_ALREADY_EXISTS');
    }

    const passwordHash = await User.hashPassword(password);

    const user = await User.create({
      name,
      email,
      passwordHash,
      role: role || 'staff',
      kycStatus: 'approved', // Internal staff/admins are pre-verified
    });

    return sendSuccess(res, 201, `${role === 'admin' ? 'Admin' : 'Staff'} user created successfully.`, {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        kycStatus: user.kycStatus,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Module 13: Admin/Staff lists users with optional role and kycStatus filters.
 */
const getAllUsers = async (req, res, next) => {
  try {
    const query = {};
    if (req.query.role) query.role = req.query.role;
    if (req.query.kycStatus) query.kycStatus = req.query.kycStatus;

    const users = await User.find(query).sort({ createdAt: -1 });

    return sendSuccess(res, 200, 'Users retrieved successfully.', {
      count: users.length,
      users,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Module 1 & 13: Update a customer's KYC verification status (Staff/Admin).
 */
const updateUserKycStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { kycStatus, remarks } = req.body;

    const user = await User.findById(id);
    if (!user) {
      throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    }

    user.kycStatus = kycStatus;
    if (!user.kycDetails) {
      user.kycDetails = {};
    }
    user.kycDetails.reviewedAt = new Date();
    user.kycDetails.reviewedBy = req.user.id;
    if (remarks) {
      user.kycDetails.remarks = remarks;
    }

    await user.save();

    return sendSuccess(res, 200, `User KYC status has been updated to '${kycStatus}'.`, {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        kycStatus: user.kycStatus,
        kycDetails: user.kycDetails,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Module 13: Admin updates user role.
 */
const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['customer', 'staff', 'admin'].includes(role)) {
      throw new AppError('Invalid role specified.', 400, 'INVALID_ROLE');
    }

    const user = await User.findById(id);
    if (!user) {
      throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    }

    // Prevent removing own admin privileges
    if (user._id.toString() === req.user.id && role !== 'admin') {
      throw new AppError('You cannot demote your own admin account.', 409, 'CANNOT_DEMOTE_SELF');
    }

    user.role = role;
    await user.save();

    return sendSuccess(res, 200, `User role updated to '${role}'.`, {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createStaffUser,
  getAllUsers,
  updateUserKycStatus,
  updateUserRole,
};
