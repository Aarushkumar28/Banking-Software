const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const { User, Account, Beneficiary, Transaction, Approval } = require('../models');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  // Clear all collections between tests
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe('Digital Banking System - Comprehensive CIA-3 Test Suite', () => {
  let adminToken, staffToken, customer1Token, customer2Token;
  let adminUser, staffUser, customer1User, customer2User;
  let cust1SavingsAccount, cust2SavingsAccount;

  // Helper to create users and tokens
  const setupBaseUsers = async () => {
    // Admin
    const adminRes = await request(app).post('/api/auth/register').send({
      name: 'Admin System',
      email: 'admin@test.com',
      password: 'Password123!',
    });
    adminUser = await User.findById(adminRes.body.data.user.id);
    adminUser.role = 'admin';
    adminUser.kycStatus = 'approved';
    await adminUser.save();

    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@test.com',
      password: 'Password123!',
    });
    adminToken = adminLogin.body.data.token;

    // Staff
    const staffRes = await request(app)
      .post('/api/admin/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Staff Member',
        email: 'staff@test.com',
        password: 'Password123!',
        role: 'staff',
      });
    staffUser = staffRes.body.data.user;

    const staffLogin = await request(app).post('/api/auth/login').send({
      email: 'staff@test.com',
      password: 'Password123!',
    });
    staffToken = staffLogin.body.data.token;

    // Customer 1
    const c1Res = await request(app).post('/api/auth/register').send({
      name: 'Customer One',
      email: 'cust1@test.com',
      password: 'Password123!',
      kycDetails: {
        documentType: 'passport',
        documentNumber: 'PASS12345',
        phone: '+1-555-1111',
        address: '100 Main St, City',
      },
    });
    customer1User = c1Res.body.data.user;
    customer1Token = c1Res.body.data.token;

    // Customer 2
    const c2Res = await request(app).post('/api/auth/register').send({
      name: 'Customer Two',
      email: 'cust2@test.com',
      password: 'Password123!',
      kycDetails: {
        documentType: 'national_id',
        documentNumber: 'NAT54321',
        phone: '+1-555-2222',
        address: '200 Oak St, City',
      },
    });
    customer2User = c2Res.body.data.user;
    customer2Token = c2Res.body.data.token;
  };

  // -------------------------------------------------------------
  // Module 1: Customer Onboarding & KYC Capture
  // -------------------------------------------------------------
  describe('Module 1: Customer Onboarding & KYC Capture', () => {
    it('should register a new customer with kycStatus=pending', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Jane Doe',
        email: 'janedoe@example.com',
        password: 'SecurePassword123!',
        kycDetails: {
          documentType: 'passport',
          documentNumber: 'AB1234567',
          phone: '+1-555-9988',
          address: '42 Wallaby Way, Sydney',
        },
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('janedoe@example.com');
      expect(res.body.data.user.kycStatus).toBe('pending');
      expect(res.body.data.token).toBeDefined();

      // Verify password hashed in database
      const dbUser = await User.findOne({ email: 'janedoe@example.com' });
      expect(dbUser.passwordHash).not.toBe('SecurePassword123!');
    });

    it('should reject registration with duplicate email with 409 Conflict', async () => {
      await request(app).post('/api/auth/register').send({
        name: 'User One',
        email: 'duplicate@example.com',
        password: 'Password123!',
      });

      const res = await request(app).post('/api/auth/register').send({
        name: 'User Two',
        email: 'duplicate@example.com',
        password: 'Password123!',
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('should login successfully and return JWT', async () => {
      await request(app).post('/api/auth/register').send({
        name: 'Login Tester',
        email: 'login@example.com',
        password: 'Password123!',
      });

      const res = await request(app).post('/api/auth/login').send({
        email: 'login@example.com',
        password: 'Password123!',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
    });

    it('should reject login with wrong password (401)', async () => {
      await request(app).post('/api/auth/register').send({
        name: 'Wrong Pass',
        email: 'wrongpass@example.com',
        password: 'Password123!',
      });

      const res = await request(app).post('/api/auth/login').send({
        email: 'wrongpass@example.com',
        password: 'WrongPassword!',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('INVALID_CREDENTIALS');
    });

    it('should reject protected route without auth token (401)', async () => {
      const res = await request(app).get('/api/auth/profile');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('AUTH_TOKEN_MISSING');
    });
  });

  // -------------------------------------------------------------
  // Module 2 & 3: Account Approval Workflow & Account Management
  // -------------------------------------------------------------
  describe('Module 2 & 3: Account Creation & Staff Approval Workflow', () => {
    beforeEach(async () => {
      await setupBaseUsers();
    });

    it('should reject account creation if customer KYC is pending (403)', async () => {
      const res = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          type: 'savings',
          initialDeposit: 5000,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('KYC_APPROVAL_REQUIRED');
    });

    it('should allow account creation once KYC is approved, created with status=pending', async () => {
      // Staff approves Customer 1 KYC
      const kycRes = await request(app)
        .patch(`/api/staff/users/${customer1User.id}/kyc`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ kycStatus: 'approved' });
      expect(kycRes.status).toBe(200);

      // Refresh customer token with approved KYC status
      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'cust1@test.com',
        password: 'Password123!',
      });
      customer1Token = loginRes.body.data.token;

      // Customer creates savings account
      const accRes = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          type: 'savings',
          initialDeposit: 10000,
        });

      expect(accRes.status).toBe(201);
      expect(accRes.body.data.account.status).toBe('pending');
      expect(accRes.body.data.account.accountNumber).toMatch(/^10\d{8}$/);
      cust1SavingsAccount = accRes.body.data.account;
    });

    it('should allow staff to approve pending account and log in approvals collection', async () => {
      // Approve KYC & create account
      await User.findByIdAndUpdate(customer1User.id, { kycStatus: 'approved' });
      const accRes = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({ type: 'savings', initialDeposit: 10000 });
      const pendingAccountId = accRes.body.data.account.id;

      // Staff approves
      const approvalRes = await request(app)
        .post(`/api/staff/accounts/${pendingAccountId}/approval`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          decision: 'approved',
          remarks: 'All KYC documentation verified and approved.',
        });

      expect(approvalRes.status).toBe(200);
      expect(approvalRes.body.data.account.status).toBe('active');

      // Verify record logged in approvals collection
      const approvalDoc = await Approval.findOne({ accountId: pendingAccountId });
      expect(approvalDoc).toBeDefined();
      expect(approvalDoc.decision).toBe('approved');
      expect(approvalDoc.remarks).toContain('All KYC documentation');

      // Verify initial deposit ledger record created
      const initialTx = await Transaction.findOne({
        accountId: pendingAccountId,
        type: 'credit',
      });
      expect(initialTx).toBeDefined();
      expect(initialTx.amount).toBe(10000);
    });

    it('should block re-approval of an already decided account with 409 Conflict', async () => {
      await User.findByIdAndUpdate(customer1User.id, { kycStatus: 'approved' });
      const accRes = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({ type: 'savings', initialDeposit: 5000 });
      const accId = accRes.body.data.account.id;

      // First decision: approved
      await request(app)
        .post(`/api/staff/accounts/${accId}/approval`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ decision: 'approved', remarks: 'First decision' });

      // Second decision attempt: should fail with 409
      const secondAttempt = await request(app)
        .post(`/api/staff/accounts/${accId}/approval`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ decision: 'rejected', remarks: 'Trying to change mind' });

      expect(secondAttempt.status).toBe(409);
      expect(secondAttempt.body.success).toBe(false);
      expect(secondAttempt.body.errorCode).toBe('ACCOUNT_ALREADY_DECIDED');
    });

    it('should enforce account ownership on GET /api/accounts/:id', async () => {
      await User.findByIdAndUpdate(customer1User.id, { kycStatus: 'approved' });
      const accRes = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({ type: 'savings', initialDeposit: 5000 });
      const c1AccountId = accRes.body.data.account.id;

      // Customer 2 attempts to view Customer 1's account -> 403
      const unauthorizedRes = await request(app)
        .get(`/api/accounts/${c1AccountId}`)
        .set('Authorization', `Bearer ${customer2Token}`);

      expect(unauthorizedRes.status).toBe(403);
      expect(unauthorizedRes.body.errorCode).toBe('RESOURCE_OWNERSHIP_DENIED');

      // Customer 1 views own account -> 200
      const authorizedRes = await request(app)
        .get(`/api/accounts/${c1AccountId}`)
        .set('Authorization', `Bearer ${customer1Token}`);

      expect(authorizedRes.status).toBe(200);
      expect(authorizedRes.body.data.account._id.toString()).toBe(c1AccountId);

      // Staff views customer account -> 200 (regulatory oversight)
      const staffRes = await request(app)
        .get(`/api/accounts/${c1AccountId}`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(staffRes.status).toBe(200);
    });
  });

  // -------------------------------------------------------------
  // Module 4: Beneficiary Management
  // -------------------------------------------------------------
  describe('Module 4: Beneficiary Management', () => {
    let acc1, acc2;

    beforeEach(async () => {
      await setupBaseUsers();
      await User.findByIdAndUpdate(customer1User.id, { kycStatus: 'approved' });
      await User.findByIdAndUpdate(customer2User.id, { kycStatus: 'approved' });

      // Create and activate account for Customer 1
      const a1Res = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({ type: 'savings', initialDeposit: 20000 });
      acc1 = a1Res.body.data.account;
      await Account.findByIdAndUpdate(acc1.id, { status: 'active' });

      // Create and activate account for Customer 2
      const a2Res = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${customer2Token}`)
        .send({ type: 'savings', initialDeposit: 10000 });
      acc2 = a2Res.body.data.account;
      await Account.findByIdAndUpdate(acc2.id, { status: 'active' });
    });

    it('should add a beneficiary successfully', async () => {
      const res = await request(app)
        .post('/api/beneficiaries')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          accountId: acc1.id,
          beneficiaryAccountNumber: acc2.accountNumber,
          nickname: 'Bob Savings',
          beneficiaryName: 'Customer Two',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.beneficiary.nickname).toBe('Bob Savings');
    });

    it('should reject adding own account as beneficiary (409 Conflict)', async () => {
      const res = await request(app)
        .post('/api/beneficiaries')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          accountId: acc1.id,
          beneficiaryAccountNumber: acc1.accountNumber,
          nickname: 'My Own Account',
          beneficiaryName: 'Self',
        });

      expect(res.status).toBe(409);
      expect(res.body.errorCode).toBe('SELF_BENEFICIARY_CONFLICT');
    });

    it('should reject adding beneficiary to an account not owned by user (403)', async () => {
      const res = await request(app)
        .post('/api/beneficiaries')
        .set('Authorization', `Bearer ${customer2Token}`)
        .send({
          accountId: acc1.id, // acc1 belongs to customer1
          beneficiaryAccountNumber: acc2.accountNumber,
          nickname: 'Intruder Add',
          beneficiaryName: 'Someone',
        });

      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe('RESOURCE_OWNERSHIP_DENIED');
    });

    it('should reject duplicate beneficiary for the same account (409)', async () => {
      await request(app)
        .post('/api/beneficiaries')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          accountId: acc1.id,
          beneficiaryAccountNumber: acc2.accountNumber,
          nickname: 'Bob Savings',
          beneficiaryName: 'Customer Two',
        });

      const duplicateRes = await request(app)
        .post('/api/beneficiaries')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          accountId: acc1.id,
          beneficiaryAccountNumber: acc2.accountNumber,
          nickname: 'Bob Duplicate',
          beneficiaryName: 'Customer Two',
        });

      expect(duplicateRes.status).toBe(409);
      expect(duplicateRes.body.errorCode).toBe('DUPLICATE_BENEFICIARY');
    });

    it('should remove a beneficiary', async () => {
      const addRes = await request(app)
        .post('/api/beneficiaries')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          accountId: acc1.id,
          beneficiaryAccountNumber: acc2.accountNumber,
          nickname: 'Bob To Delete',
          beneficiaryName: 'Customer Two',
        });
      const benId = addRes.body.data.beneficiary._id;

      const delRes = await request(app)
        .delete(`/api/beneficiaries/${benId}`)
        .set('Authorization', `Bearer ${customer1Token}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);

      const check = await Beneficiary.findById(benId);
      expect(check).toBeNull();
    });
  });

  // -------------------------------------------------------------
  // Module 5, 6, 8, 9: Fund Transfer Engine & Ledger & Limits
  // -------------------------------------------------------------
  describe('Module 5, 6, 8, 9: Fund Transfer, Ledger, Limits & Flagging', () => {
    let sourceAcc, destAcc;

    beforeEach(async () => {
      await setupBaseUsers();
      await User.findByIdAndUpdate(customer1User.id, { kycStatus: 'approved' });
      await User.findByIdAndUpdate(customer2User.id, { kycStatus: 'approved' });

      // Create active account for Customer 1 ($20,000 balance, minBalance $1,000, dailyLimit $50,000)
      const a1 = await Account.create({
        userId: customer1User.id,
        accountNumber: '1011111111',
        type: 'savings',
        balance: 20000,
        status: 'active',
        minBalance: 1000,
        dailyTransferLimit: 50000,
      });
      sourceAcc = a1;

      // Create active account for Customer 2 ($5,000 balance)
      const a2 = await Account.create({
        userId: customer2User.id,
        accountNumber: '1022222222',
        type: 'savings',
        balance: 5000,
        status: 'active',
        minBalance: 1000,
        dailyTransferLimit: 50000,
      });
      destAcc = a2;
    });

    it('should transfer funds successfully, updating balances and creating immutable ledger records', async () => {
      const res = await request(app)
        .post('/api/transactions/transfer')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          sourceAccountId: sourceAcc._id.toString(),
          destinationAccountNumber: destAcc.accountNumber,
          amount: 3000,
          description: 'Payment for consultation services',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transfer.newBalance).toBe(17000);

      // Verify database balances
      const updatedSource = await Account.findById(sourceAcc._id);
      const updatedDest = await Account.findById(destAcc._id);
      expect(updatedSource.balance).toBe(17000);
      expect(updatedDest.balance).toBe(8000);

      // Verify immutable debit transaction
      const debitTx = await Transaction.findOne({
        accountId: sourceAcc._id,
        type: 'debit',
      });
      expect(debitTx).toBeDefined();
      expect(debitTx.amount).toBe(3000);
      expect(debitTx.balanceAfter).toBe(17000);
      expect(debitTx.relatedAccount).toBe(destAcc.accountNumber);
      expect(debitTx.flagged).toBe(false);

      // Verify immutable credit transaction
      const creditTx = await Transaction.findOne({
        accountId: destAcc._id,
        type: 'credit',
      });
      expect(creditTx).toBeDefined();
      expect(creditTx.amount).toBe(3000);
      expect(creditTx.balanceAfter).toBe(8000);
      expect(creditTx.relatedAccount).toBe(sourceAcc.accountNumber);
    });

    it('should reject transfer that violates minimum balance requirement (409 Conflict)', async () => {
      // Balance is $20,000, minBalance is $1,000. Transferring $19,500 would leave $500 (< $1,000)
      const res = await request(app)
        .post('/api/transactions/transfer')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          sourceAccountId: sourceAcc._id.toString(),
          destinationAccountNumber: destAcc.accountNumber,
          amount: 19500,
          description: 'Too much money',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('MINIMUM_BALANCE_BREACH');

      // Balances must remain unchanged
      const checkSource = await Account.findById(sourceAcc._id);
      expect(checkSource.balance).toBe(20000);
    });

    it('should reject transfer exceeding daily transfer limit (409 Conflict)', async () => {
      // Set daily limit to $10,000 for this test
      await Account.findByIdAndUpdate(sourceAcc._id, { dailyTransferLimit: 10000 });

      // 1st transfer: $7,000 (succeeds)
      const res1 = await request(app)
        .post('/api/transactions/transfer')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          sourceAccountId: sourceAcc._id.toString(),
          destinationAccountNumber: destAcc.accountNumber,
          amount: 7000,
        });
      expect(res1.status).toBe(201);

      // 2nd transfer: $4,000 (total $11,000 > $10,000 limit -> 409 Conflict)
      const res2 = await request(app)
        .post('/api/transactions/transfer')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          sourceAccountId: sourceAcc._id.toString(),
          destinationAccountNumber: destAcc.accountNumber,
          amount: 4000,
        });

      expect(res2.status).toBe(409);
      expect(res2.body.errorCode).toBe('DAILY_LIMIT_EXCEEDED');
    });

    it('should automatically flag suspicious transactions above threshold', async () => {
      // Increase balance and limit to allow 60,000 transfer (SUSPICIOUS_THRESHOLD is 50,000)
      await Account.findByIdAndUpdate(sourceAcc._id, {
        balance: 100000,
        dailyTransferLimit: 200000,
      });

      const res = await request(app)
        .post('/api/transactions/transfer')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          sourceAccountId: sourceAcc._id.toString(),
          destinationAccountNumber: destAcc.accountNumber,
          amount: 60000,
          description: 'Large investment transfer',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.transfer.flagged).toBe(true);

      const debitTx = await Transaction.findById(res.body.data.transfer.debitTransactionId);
      expect(debitTx.flagged).toBe(true);
    });

    it('should enforce immutable ledger: prevent update or delete of transactions', async () => {
      const tx = await Transaction.create({
        accountId: sourceAcc._id,
        type: 'credit',
        amount: 500,
        balanceAfter: 20500,
        relatedAccount: 'TEST_COUNTERPARTY',
      });

      // Attempt to update transaction
      let updateError;
      try {
        await Transaction.updateOne({ _id: tx._id }, { amount: 9999 });
      } catch (err) {
        updateError = err;
      }
      expect(updateError).toBeDefined();
      expect(updateError.errorCode).toBe('TRANSACTION_IMMUTABLE');

      // Attempt to delete transaction
      let deleteError;
      try {
        await Transaction.deleteOne({ _id: tx._id });
      } catch (err) {
        deleteError = err;
      }
      expect(deleteError).toBeDefined();
      expect(deleteError.errorCode).toBe('TRANSACTION_IMMUTABLE');
    });
  });

  // -------------------------------------------------------------
  // Module 7: Account Statement Generation
  // -------------------------------------------------------------
  describe('Module 7: Account Statement Generation', () => {
    it('should generate accurate account statements with financial aggregation', async () => {
      await setupBaseUsers();
      await User.findByIdAndUpdate(customer1User.id, { kycStatus: 'approved' });

      const acc = await Account.create({
        userId: customer1User.id,
        accountNumber: '1077777777',
        type: 'savings',
        balance: 15000,
        status: 'active',
      });

      // Seed transactions
      await Transaction.collection.insertMany([
        {
          accountId: acc._id,
          type: 'credit',
          amount: 20000,
          balanceAfter: 20000,
          relatedAccount: 'DEPOSIT',
          createdAt: new Date('2026-01-01'),
        },
        {
          accountId: acc._id,
          type: 'debit',
          amount: 5000,
          balanceAfter: 15000,
          relatedAccount: 'VENDOR_PAYMENT',
          createdAt: new Date('2026-01-15'),
        },
      ]);

      const res = await request(app)
        .get(`/api/accounts/${acc._id}/statement?from=2026-01-01&to=2026-01-31`)
        .set('Authorization', `Bearer ${customer1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.statement.summary.totalCredits).toBe(20000);
      expect(res.body.data.statement.summary.totalDebits).toBe(5000);
      expect(res.body.data.statement.summary.netFlow).toBe(15000);
      expect(res.body.data.statement.transactions.length).toBe(2);
    });
  });

  // -------------------------------------------------------------
  // Module 10: Account Freeze / Unfreeze
  // -------------------------------------------------------------
  describe('Module 10: Account Freeze/Unfreeze', () => {
    let testAccount, destAccount;

    beforeEach(async () => {
      await setupBaseUsers();
      await User.findByIdAndUpdate(customer1User.id, { kycStatus: 'approved' });
      await User.findByIdAndUpdate(customer2User.id, { kycStatus: 'approved' });

      testAccount = await Account.create({
        userId: customer1User.id,
        accountNumber: '1099999999',
        type: 'savings',
        balance: 10000,
        status: 'active',
      });

      destAccount = await Account.create({
        userId: customer2User.id,
        accountNumber: '1088888888',
        type: 'savings',
        balance: 5000,
        status: 'active',
      });
    });

    it('should allow staff to freeze an account', async () => {
      const res = await request(app)
        .patch(`/api/staff/accounts/${testAccount._id}/freeze`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ reason: 'Suspected AML activity' });

      expect(res.status).toBe(200);
      expect(res.body.data.account.status).toBe('frozen');

      const dbAcc = await Account.findById(testAccount._id);
      expect(dbAcc.status).toBe('frozen');
    });

    it('should reject transfers from frozen accounts with 403 Forbidden', async () => {
      // Freeze account
      await Account.findByIdAndUpdate(testAccount._id, { status: 'frozen' });

      const res = await request(app)
        .post('/api/transactions/transfer')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          sourceAccountId: testAccount._id.toString(),
          destinationAccountNumber: destAccount.accountNumber,
          amount: 500,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('ACCOUNT_FROZEN');
    });

    it('should allow staff to unfreeze an account', async () => {
      await Account.findByIdAndUpdate(testAccount._id, { status: 'frozen' });

      const res = await request(app)
        .patch(`/api/staff/accounts/${testAccount._id}/unfreeze`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.account.status).toBe('active');
    });
  });

  // -------------------------------------------------------------
  // Module 11: Interest Calculation Job Logic
  // -------------------------------------------------------------
  describe('Module 11: Interest Calculation Job Logic', () => {
    it('should calculate and credit interest to active savings accounts', async () => {
      await setupBaseUsers();
      await User.findByIdAndUpdate(customer1User.id, { kycStatus: 'approved' });

      const savingsAcc = await Account.create({
        userId: customer1User.id,
        accountNumber: '1066666666',
        type: 'savings',
        balance: 100000,
        status: 'active',
      });

      const res = await request(app)
        .post('/api/staff/jobs/calculate-interest')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          annualRate: 0.05, // 5% p.a.
          periodDays: 30,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary.accountsCredited).toBe(1);

      // Verify interest credited in database: 100,000 * 0.05 * 30 / 365 = 410.96
      const updatedAcc = await Account.findById(savingsAcc._id);
      expect(updatedAcc.balance).toBeCloseTo(100410.96, 1);

      // Verify credit ledger record exists
      const interestTx = await Transaction.findOne({
        accountId: savingsAcc._id,
        relatedAccount: 'SYSTEM_INTEREST',
      });
      expect(interestTx).toBeDefined();
      expect(interestTx.type).toBe('credit');
      expect(interestTx.amount).toBeCloseTo(410.96, 1);
    });
  });

  // -------------------------------------------------------------
  // Module 12: Staff Monitoring Dashboard
  // -------------------------------------------------------------
  describe('Module 12: Staff Monitoring Dashboard', () => {
    beforeEach(async () => {
      await setupBaseUsers();
    });

    it('should allow staff/admin to view flagged transactions', async () => {
      const acc = await Account.create({
        userId: customer1User.id,
        accountNumber: '1055555555',
        type: 'savings',
        balance: 50000,
        status: 'active',
      });

      await Transaction.collection.insertOne({
        accountId: acc._id,
        type: 'debit',
        amount: 75000,
        balanceAfter: 25000,
        relatedAccount: 'COUNTERPARTY',
        description: 'Large flagged transfer',
        flagged: true,
        createdAt: new Date(),
      });

      const res = await request(app)
        .get('/api/staff/flagged-transactions')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.transactions[0].flagged).toBe(true);
    });

    it('should allow staff to view pending account approvals', async () => {
      await Account.create({
        userId: customer1User.id,
        accountNumber: '1044444444',
        type: 'savings',
        balance: 1000,
        status: 'pending',
      });

      const res = await request(app)
        .get('/api/staff/pending-approvals')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBeGreaterThanOrEqual(1);
    });

    it('should return system-wide dashboard statistics for staff', async () => {
      const res = await request(app)
        .get('/api/staff/dashboard-stats')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.stats.accounts).toBeDefined();
      expect(res.body.data.stats.kyc).toBeDefined();
      expect(res.body.data.stats.financials).toBeDefined();
    });

    it('should reject non-staff/non-admin users accessing staff dashboard (403)', async () => {
      const res = await request(app)
        .get('/api/staff/dashboard-stats')
        .set('Authorization', `Bearer ${customer1Token}`);

      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe('FORBIDDEN_ROLE_ACCESS');
    });
  });

  // -------------------------------------------------------------
  // Module 13: RBAC & Admin User Administration
  // -------------------------------------------------------------
  describe('Module 13: Role-Based Access Control & Admin Features', () => {
    beforeEach(async () => {
      await setupBaseUsers();
    });

    it('should allow admin to create a new staff account', async () => {
      const res = await request(app)
        .post('/api/admin/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'New Staff Officer',
          email: 'officer2@bank.com',
          password: 'Password123!',
          role: 'staff',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('staff');
    });

    it('should prevent staff from accessing admin endpoints (403)', async () => {
      const res = await request(app)
        .post('/api/admin/staff')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          name: 'Unauthorized Attempt',
          email: 'hack@bank.com',
          password: 'Password123!',
          role: 'staff',
        });

      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe('FORBIDDEN_ROLE_ACCESS');
    });

    it('should allow admin to list all users with filters', async () => {
      const res = await request(app)
        .get('/api/admin/users?role=customer')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(2); // customer1 and customer2
    });

    it('should allow admin to update a user role', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${customer1User.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'staff' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe('staff');
    });
  });
});
