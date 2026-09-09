const { AppError } = require('../utils/apiResponse');

/**
 * Generic Joi request validation middleware.
 * @param {import('joi').ObjectSchema} schema - Joi validation schema
 * @param {'body' | 'query' | 'params'} target - Request property to validate
 */
const validate = (schema, target = 'body') => {
  return (req, res, next) => {
    if (!schema) return next();

    const { error, value } = schema.validate(req[target], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const formattedErrors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/['"]/g, ''),
      }));

      const combinedMessage = formattedErrors.map((e) => e.message).join('; ');

      return next(
        new AppError(
          `Validation failed: ${combinedMessage}`,
          400,
          'VALIDATION_ERROR',
          formattedErrors
        )
      );
    }

    // Replace request property with cleaned/typecast validated values
    req[target] = value;
    next();
  };
};

module.exports = validate;
