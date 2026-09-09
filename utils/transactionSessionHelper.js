const mongoose = require('mongoose');

/**
 * Executes a database operation within a Mongoose transaction session if supported.
 * Falls back gracefully to non-session execution on standalone MongoDB instances.
 * 
 * @param {Function} callback - async (session) => result
 * @returns {Promise<any>}
 */
const runWithTransaction = async (callback) => {
  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const result = await callback(session);

    await session.commitTransaction();
    return result;
  } catch (error) {
    if (session) {
      try {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
      } catch (abortErr) {
        console.error('[Transaction] Error aborting transaction:', abortErr.message);
      }
    }

    // Check if error is due to standalone MongoDB not supporting transactions
    const isStandaloneError = 
      error.message && 
      (error.message.includes('replica set') || 
       error.message.includes('Transaction numbers are only allowed'));

    if (isStandaloneError) {
      console.warn('[Transaction] Running without replica set session fallback');
      return await callback(null);
    }

    throw error;
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

module.exports = {
  runWithTransaction,
};
