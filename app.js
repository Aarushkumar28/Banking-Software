const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Route imports
const authRoutes = require('./routes/authRoutes');
const accountRoutes = require('./routes/accountRoutes');
const beneficiaryRoutes = require('./routes/beneficiaryRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const staffRoutes = require('./routes/staffRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Middleware imports
const errorHandler = require('./middleware/errorHandler');
const { AppError, sendSuccess } = require('./utils/apiResponse');

const path = require('path');
const mongoose = require('mongoose');

const { connectDB } = require('./config/db');

const app = express();

// Security and utility middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static frontend UI assets immediately without waiting for DB
app.use(express.static(path.join(__dirname, 'public')));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health check endpoint (serves immediately)
app.get('/api/health', (req, res) => {
  return sendSuccess(res, 200, 'Digital Banking API is healthy and operational.', {
    uptime: process.uptime(),
    dbConnected: mongoose.connection.readyState === 1,
    timestamp: new Date().toISOString(),
  });
});

// Serverless DB connection middleware (scoped to API data routes)
app.use('/api', async (req, res, next) => {
  if (process.env.NODE_ENV === 'test' || mongoose.connection.readyState === 1) {
    return next();
  }
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/beneficiaries', beneficiaryRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/admin', adminRoutes);

// Catch-all 404 handler
app.use('*', (req, res, next) => {
  next(new AppError(`Cannot find endpoint ${req.method} ${req.originalUrl} on this server.`, 404, 'ROUTE_NOT_FOUND'));
});

// Centralized error handler
app.use(errorHandler);

module.exports = app;
