const { sendError } = require('../utils/apiResponse');

/**
 * Centralized error-handling middleware.
 * Guarantees standard JSON error shape: { success: false, message, errorCode }
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'An unexpected internal server error occurred';
  let errorCode = err.errorCode || 'INTERNAL_SERVER_ERROR';
  let details = err.details || null;

  // Handle Mongoose CastError (e.g. invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid format for field: ${err.path}`;
    errorCode = 'INVALID_IDENTIFIER_FORMAT';
  }

  // Handle Mongoose duplicate key error (E11000)
  if (err.code === 11000) {
    statusCode = 409;
    const duplicatedField = Object.keys(err.keyValue || {})[0] || 'field';
    const duplicatedValue = err.keyValue ? err.keyValue[duplicatedField] : '';
    message = `Duplicate entry conflict: '${duplicatedField}' with value '${duplicatedValue}' already exists.`;
    errorCode = 'DUPLICATE_RESOURCE_CONFLICT';
  }

  // Handle Mongoose Schema Validation Error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ');
    errorCode = 'SCHEMA_VALIDATION_ERROR';
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token provided';
    errorCode = 'INVALID_AUTH_TOKEN';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired. Please log in again.';
    errorCode = 'AUTH_TOKEN_EXPIRED';
  }

  // Log 500 errors to console for server debugging
  if (statusCode >= 500 && process.env.NODE_ENV !== 'test') {
    console.error('[Unhandled Error]', err);
  }

  return sendError(res, statusCode, message, errorCode, details);
};

module.exports = errorHandler;
