const app = require('./app');
const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');

// Handle uncaught exceptions gracefully
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err);
  process.exit(1);
});

let server;

const startServer = async () => {
  server = app.listen(env.PORT, () => {
    console.log(`[Server] Digital Banking API running on http://localhost:${env.PORT}`);
    console.log(`[Server] Environment: ${env.NODE_ENV}`);
  });

  try {
    await connectDB();
  } catch (error) {
    console.error('[Server] Database initial connection failed:', error.message);
    console.log('[Server] Server remains active. Reconnect will be attempted on incoming requests.');
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('[CRITICAL] Unhandled Promise Rejection:', err);
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

// Graceful termination handling
const gracefulShutdown = async (signal) => {
  console.log(`[Server] Received ${signal}. Starting graceful shutdown...`);
  if (server) {
    server.close(async () => {
      console.log('[Server] HTTP server closed.');
      await disconnectDB();
      process.exit(0);
    });
  } else {
    await disconnectDB();
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();
