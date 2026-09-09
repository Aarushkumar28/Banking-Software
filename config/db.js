const mongoose = require('mongoose');
const env = require('./env');

const connectDB = async (customUri = null) => {
  const uri = customUri || env.MONGODB_URI;

  try {
    const conn = await mongoose.connect(uri);
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`[Database] Connection Error: ${error.message}`);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw error;
  }
};

mongoose.connection.on('disconnected', () => {
  if (process.env.NODE_ENV !== 'test') {
    console.warn('[Database] MongoDB disconnected');
  }
});

mongoose.connection.on('reconnected', () => {
  console.log('[Database] MongoDB reconnected');
});

const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    console.log('[Database] MongoDB connection closed');
  } catch (error) {
    console.error(`[Database] Disconnect Error: ${error.message}`);
  }
};

module.exports = {
  connectDB,
  disconnectDB,
};
