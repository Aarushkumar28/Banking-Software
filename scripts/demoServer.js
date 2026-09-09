const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const env = require('../config/env');

const runDemo = async () => {
  try {
    console.log('[Demo] Starting in-memory MongoDB instance for instant browser evaluation...');
    const mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    console.log(`[Demo] In-memory database started at: ${uri}`);

    // Set MONGODB_URI to in-memory URI
    process.env.MONGODB_URI = uri;
    env.MONGODB_URI = uri;

    // Run seedData
    const seedData = require('./seed');
    await seedData();

    // Reconnect for app
    const { connectDB } = require('../config/db');
    await connectDB(uri);

    const app = require('../app');
    const port = env.PORT || 5001;

    app.listen(port, () => {
      console.log('\n======================================================');
      console.log(`🚀 DIGITAL BANKING PORTAL IS LIVE & READY!`);
      console.log(`👉 Open in your browser: http://localhost:${port}/`);
      console.log(`👉 API Health Endpoint:  http://localhost:${port}/api/health`);
      console.log('======================================================\n');
    });
  } catch (error) {
    console.error('[Demo] Failed to start demo server:', error);
    process.exit(1);
  }
};

runDemo();
