const mongoose = require('mongoose');
const env = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const { User, Account, Beneficiary, Transaction, Approval } = require('../models');

const seedData = async () => {
  try {
    console.log('[Seed] Connecting to database...');
    await connectDB();

    console.log('[Seed] Clearing existing collections...');
    await Promise.all([
      User.deleteMany({}),
      Account.deleteMany({}),
      Beneficiary.deleteMany({}),
      Transaction.collection.deleteMany({}), // bypass model pre-hook for seeding reset
      Approval.deleteMany({}),
    ]);

    console.log('[Seed] Creating demo users...');
    const defaultPasswordHash = await User.hashPassword('Password123!');

    // 1. Admin
    const admin = await User.create({
      name: 'Super Administrator',
      email: 'admin@bank.com',
      passwordHash: defaultPasswordHash,
      role: 'admin',
      kycStatus: 'approved',
    });

    // 2. Staff
    const staff = await User.create({
      name: 'Bank Staff Officer',
      email: 'staff@bank.com',
      passwordHash: defaultPasswordHash,
      role: 'staff',
      kycStatus: 'approved',
    });

    // 3. Customer 1 (Alice - Approved KYC)
    const alice = await User.create({
      name: 'Alice Johnson',
      email: 'alice@customer.com',
      passwordHash: defaultPasswordHash,
      role: 'customer',
      kycStatus: 'approved',
      kycDetails: {
        documentType: 'passport',
        documentNumber: 'P8934215',
        phone: '+1-555-0101',
        address: '123 Wall Street, New York, NY',
        submittedAt: new Date(),
        reviewedAt: new Date(),
        reviewedBy: staff._id,
      },
    });

    // 4. Customer 2 (Bob - Approved KYC)
    const bob = await User.create({
      name: 'Bob Smith',
      email: 'bob@customer.com',
      passwordHash: defaultPasswordHash,
      role: 'customer',
      kycStatus: 'approved',
      kycDetails: {
        documentType: 'national_id',
        documentNumber: 'NAT-44219',
        phone: '+1-555-0102',
        address: '456 Market St, San Francisco, CA',
        submittedAt: new Date(),
        reviewedAt: new Date(),
        reviewedBy: staff._id,
      },
    });

    // 5. Customer 3 (Charlie - Pending KYC)
    const charlie = await User.create({
      name: 'Charlie Brown',
      email: 'charlie@customer.com',
      passwordHash: defaultPasswordHash,
      role: 'customer',
      kycStatus: 'pending',
      kycDetails: {
        documentType: 'driving_license',
        documentNumber: 'DL-881234',
        phone: '+1-555-0103',
        address: '789 Pine Ave, Chicago, IL',
        submittedAt: new Date(),
      },
    });

    // 6. Customer 4 (David - Approved KYC, with pending account)
    const david = await User.create({
      name: 'David Wilson',
      email: 'david@customer.com',
      passwordHash: defaultPasswordHash,
      role: 'customer',
      kycStatus: 'approved',
      kycDetails: {
        documentType: 'passport',
        documentNumber: 'P902198',
        phone: '+1-555-0104',
        address: '321 Elm St, Boston, MA',
        submittedAt: new Date(),
        reviewedAt: new Date(),
        reviewedBy: staff._id,
      },
    });

    // 7. Customer 5 (Eve - Approved KYC, with frozen account)
    const eve = await User.create({
      name: 'Eve Adams',
      email: 'eve@customer.com',
      passwordHash: defaultPasswordHash,
      role: 'customer',
      kycStatus: 'approved',
    });

    console.log('[Seed] Creating bank accounts...');
    // Alice's Savings Account (Active, $25,000)
    const aliceSavings = await Account.create({
      userId: alice._id,
      accountNumber: '1088991001',
      type: 'savings',
      balance: 25000,
      status: 'active',
      minBalance: 1000,
      dailyTransferLimit: 50000,
    });

    // Alice's Current Account (Active, $80,000)
    const aliceCurrent = await Account.create({
      userId: alice._id,
      accountNumber: '2088991002',
      type: 'current',
      balance: 80000,
      status: 'active',
      minBalance: 5000,
      dailyTransferLimit: 200000,
    });

    // Bob's Savings Account (Active, $15,000)
    const bobSavings = await Account.create({
      userId: bob._id,
      accountNumber: '1099222001',
      type: 'savings',
      balance: 15000,
      status: 'active',
      minBalance: 1000,
      dailyTransferLimit: 50000,
    });

    // David's Pending Account (Awaiting Staff Approval)
    const davidPending = await Account.create({
      userId: david._id,
      accountNumber: '1033443001',
      type: 'savings',
      balance: 5000,
      status: 'pending',
      minBalance: 1000,
      dailyTransferLimit: 50000,
    });

    // Eve's Frozen Account (Frozen by staff)
    const eveFrozen = await Account.create({
      userId: eve._id,
      accountNumber: '1055665001',
      type: 'savings',
      balance: 12000,
      status: 'frozen',
      minBalance: 1000,
      dailyTransferLimit: 50000,
    });

    console.log('[Seed] Creating initial ledger transactions...');
    await Transaction.collection.insertMany([
      {
        accountId: aliceSavings._id,
        type: 'credit',
        amount: 25000,
        balanceAfter: 25000,
        relatedAccount: 'INITIAL_DEPOSIT',
        description: 'Account Opening Initial Deposit',
        flagged: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10), // 10 days ago
      },
      {
        accountId: aliceCurrent._id,
        type: 'credit',
        amount: 80000,
        balanceAfter: 80000,
        relatedAccount: 'INITIAL_DEPOSIT',
        description: 'Corporate Initial Funding',
        flagged: true, // breach >= 50,000 threshold
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
      },
      {
        accountId: bobSavings._id,
        type: 'credit',
        amount: 15000,
        balanceAfter: 15000,
        relatedAccount: 'INITIAL_DEPOSIT',
        description: 'Account Opening Deposit',
        flagged: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
      },
      {
        accountId: eveFrozen._id,
        type: 'credit',
        amount: 12000,
        balanceAfter: 12000,
        relatedAccount: 'INITIAL_DEPOSIT',
        description: 'Opening Deposit',
        flagged: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
      },
    ]);

    console.log('[Seed] Creating sample beneficiaries...');
    // Alice adds Bob as beneficiary on her savings account
    await Beneficiary.create({
      accountId: aliceSavings._id,
      beneficiaryAccountNumber: bobSavings.accountNumber,
      nickname: "Bob's Personal Savings",
      beneficiaryName: 'Bob Smith',
    });

    console.log('\n======================================================');
    console.log(' DATABASE SEEDING COMPLETED SUCCESSFULLY!');
    console.log('======================================================');
    console.log('Credentials for all pre-seeded accounts:');
    console.log('Password for all users: Password123!\n');
    console.log('1. Admin:    admin@bank.com');
    console.log('2. Staff:    staff@bank.com');
    console.log('3. Alice:    alice@customer.com    (KYC Approved, Active Savings + Current)');
    console.log(`   - Savings A/C: ${aliceSavings.accountNumber} ($25,000)`);
    console.log(`   - Current A/C: ${aliceCurrent.accountNumber} ($80,000)`);
    console.log('4. Bob:      bob@customer.com      (KYC Approved, Active Savings)');
    console.log(`   - Savings A/C: ${bobSavings.accountNumber} ($15,000)`);
    console.log('5. Charlie:  charlie@customer.com  (KYC Pending)');
    console.log('6. David:    david@customer.com    (KYC Approved, Pending A/C: ' + davidPending.accountNumber + ')');
    console.log('7. Eve:      eve@customer.com      (KYC Approved, Frozen A/C: ' + eveFrozen.accountNumber + ')');
    console.log('======================================================\n');
  } catch (error) {
    console.error('[Seed] Seeding failed:', error);
  } finally {
    await disconnectDB();
  }
};

if (require.main === module) {
  seedData();
}

module.exports = seedData;
