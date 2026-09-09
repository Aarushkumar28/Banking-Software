const dotenv = require('dotenv');
dotenv.config();

const env = {
  PORT: process.env.PORT || 5001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/digital_banking_db',
  JWT_SECRET: process.env.JWT_SECRET || 'super_secret_jwt_key_academic_cia3_banking_app_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1d',
  SUSPICIOUS_THRESHOLD: Number(process.env.SUSPICIOUS_THRESHOLD) || 50000,
  SAVINGS_ANNUAL_INTEREST_RATE: Number(process.env.SAVINGS_ANNUAL_INTEREST_RATE) || 0.04,
  DEFAULT_SAVINGS_MIN_BALANCE: Number(process.env.DEFAULT_SAVINGS_MIN_BALANCE) || 1000,
  DEFAULT_CURRENT_MIN_BALANCE: Number(process.env.DEFAULT_CURRENT_MIN_BALANCE) || 5000,
  DEFAULT_SAVINGS_DAILY_LIMIT: Number(process.env.DEFAULT_SAVINGS_DAILY_LIMIT) || 50000,
  DEFAULT_CURRENT_DAILY_LIMIT: Number(process.env.DEFAULT_CURRENT_DAILY_LIMIT) || 200000,
};

module.exports = env;
