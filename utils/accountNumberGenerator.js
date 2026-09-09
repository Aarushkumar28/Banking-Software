const crypto = require('crypto');

/**
 * Generates a unique 10-digit bank account number.
 * Format: 2-digit branch/type code + 8 pseudorandom digits
 * @param {string} accountType - 'savings' or 'current'
 * @returns {string} 10-digit account number string
 */
const generateAccountNumber = (accountType = 'savings') => {
  const prefix = accountType.toLowerCase() === 'current' ? '20' : '10';
  const randomDigits = Math.floor(10000000 + Math.random() * 90000000).toString();
  return `${prefix}${randomDigits}`;
};

module.exports = {
  generateAccountNumber,
};
