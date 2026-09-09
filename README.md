# Digital Banking Account & Transaction Management System
### Academic Project (CIA-3) — Node.js, Express.js, MongoDB (Mongoose)

A secure, audit-ready, enterprise-grade digital banking backend engineered following the **Model-View-Controller (MVC)** architectural pattern. The system implements multi-tier role-based access control (RBAC), fine-grained resource ownership verification, atomic ACID fund transfers, immutable append-only transaction ledgers, AML/fraud suspicious activity flagging, daily limit and minimum balance enforcement, automated interest calculation, and staff administrative oversight.

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Folder Structure](#folder-structure)
4. [Collections, Schemas & ER Design (Embed vs. Reference)](#collections-schemas--er-design-embed-vs-reference)
5. [The 13 Business Logic Modules](#the-13-business-logic-modules)
6. [API Endpoint Matrix](#api-endpoint-matrix)
7. [Response Convention & Error Handling](#response-convention--error-handling)
8. [Setup & Execution Instructions](#setup--execution-instructions)
9. [Automated Testing](#automated-testing)
10. [Postman Collection Usage](#postman-collection-usage)
11. [Known Limitations & Production Considerations](#known-limitations--production-considerations)

---

## Project Overview

The **Digital Banking Account & Transaction Management System** addresses the core operational, compliance, and ledger management requirements of modern commercial banking institutions:
- **KYC & Account Onboarding**: Enforces Know-Your-Customer (KYC) compliance verification before accounts can be opened.
- **Strict Ledger Immutability**: All financial movements produce immutable double-entry credit and debit ledger records that can never be updated or deleted.
- **Atomic Fund Transfers**: Uses Mongoose transactions and session locks to guarantee isolation and consistency during concurrent balance deductions and credits.
- **Risk Mitigation & AML Compliance**: Automatically flags transactions exceeding threshold values and restricts operations on frozen accounts.
- **Role-Based Access Control**: Strict segregation of duties across `Customer`, `Bank Staff`, and `Admin` users with cryptographic ownership checks on every protected route.

---

## Technology Stack

- **Runtime**: Node.js (v18+ / v20+)
- **Framework**: Express.js (v4.21+)
- **Database**: MongoDB with Mongoose (v8.9+) ODM
- **Authentication**: JSON Web Tokens (`jsonwebtoken`)
- **Password Security**: Salted Bcrypt hashing (`bcryptjs`)
- **Request Validation**: Schema-based validation via `Joi`
- **Security & Utilities**: `helmet`, `cors`, `morgan`, `dotenv`
- **Testing**: `jest`, `supertest`, `mongodb-memory-server`

---

## Folder Structure

```
Banking Software/
├── config/
│   ├── db.js                 # Database connection & lifecycle management
│   └── env.js                # Centralized environment variable loader & defaults
├── controllers/
│   ├── accountController.js  # Account creation, listing, and balance retrieval
│   ├── adminController.js    # Staff provisioning, user management, role updates
│   ├── approvalController.js # Staff account approval/rejection workflow
│   ├── authController.js     # Customer registration, KYC submission, login
│   ├── beneficiaryController.js # Beneficiary registration and management
│   ├── staffController.js    # Freeze/unfreeze, interest job, staff dashboard
│   ├── statementController.js# Statement generation & financial aggregations
│   └── transactionController.js # Fund transfer engine & immutable ledger viewer
├── middleware/
│   ├── auth.js               # JWT verification, RBAC authorize(), requireAccountOwnership()
│   ├── errorHandler.js       # Centralized error handler with standard JSON error shape
│   └── validate.js           # Generic Joi request validation middleware
├── models/
│   ├── Account.js            # Bank account schema & business constraints
│   ├── Approval.js           # Audit trail for staff account approval decisions
│   ├── Beneficiary.js        # Registered counterparty beneficiaries
│   ├── index.js              # Model registry aggregator
│   ├── Transaction.js        # Immutable financial ledger schema
│   └── User.js               # User accounts, hashed credentials, KYC data
├── routes/
│   ├── accountRoutes.js      # /api/accounts
│   ├── adminRoutes.js        # /api/admin
│   ├── authRoutes.js         # /api/auth
│   ├── beneficiaryRoutes.js  # /api/beneficiaries
│   ├── staffRoutes.js        # /api/staff
│   └── transactionRoutes.js  # /api/transactions
├── scripts/
│   └── seed.js               # Database seeding script with demo credentials
├── tests/
│   └── banking.test.js       # Comprehensive 33-test integration suite
├── utils/
│   ├── accountNumberGenerator.js # Cryptographic 10-digit account number generator
│   ├── apiResponse.js        # Standard success & error response helpers, AppError
│   ├── transactionSessionHelper.js # ACID transaction wrapper with standalone fallback
│   └── validators.js         # Centralized Joi schemas for request validation
├── .env.example              # Template for environment configuration
├── app.js                    # Express app initialization & middleware configuration
├── Digital_Banking_API.postman_collection.json # Exported Postman collection
├── package.json              # Project manifests and test scripts
├── README.md                 # Complete system documentation
└── server.js                 # HTTP listener & process graceful shutdown
```

---

## Collections, Schemas & ER Design (Embed vs. Reference)

In MongoDB, architectural decisions between **embedding** (denormalization) and **referencing** (normalization) govern performance, consistency, document size limits (16MB BSON cap), and index efficiency.

```
                    ┌───────────────────────────┐
                    │           USERS           │
                    │ _id, name, email, role,   │
                    │ passwordHash, kycStatus   │
                    └─────────────┬─────────────┘
                                  │ 1 : N
                                  ▼
                    ┌───────────────────────────┐
                    │         ACCOUNTS          │
                    │ _id, userId (ref), balance│
                    │ status, minBalance, limits│
                    └──────┬──────────────┬─────┘
                     1 : N │              │ 1 : N
        ┌──────────────────┘              └──────────────────┐
        ▼                                                    ▼
┌─────────────────────────┐                        ┌───────────────────┐
│      TRANSACTIONS       │                        │   BENEFICIARIES   │
│ (Immutable Ledger)      │                        │ _id, accountId,   │
│ accountId (ref), amount │                        │ accountNumber,    │
│ type, balanceAfter      │                        │ nickname          │
└─────────────────────────┘                        └───────────────────┘
```

### Architectural Reasoning

| Collection | Relationship | Design Choice | Architectural Rationale |
| :--- | :--- | :--- | :--- |
| **`users`** | Core Identity | Independent Collection | Primary identity document holding authentication credentials and KYC verification status. |
| **`accounts`** | 1 User $\rightarrow$ N Accounts | **Referenced** (`userId`) | A user can possess multiple accounts (Savings, Current). Storing accounts inside the `users` document would cause unbounded document growth and lock contention whenever balance updates occur. |
| **`beneficiaries`**| 1 Account $\rightarrow$ N Beneficiaries | **Referenced** (`accountId`) | Allows indexing on `beneficiaryAccountNumber`, avoids document rewriting on the parent account, and enforces unique compound indexing (`accountId` + `beneficiaryAccountNumber`). |
| **`transactions`** | 1 Account $\rightarrow$ N Transactions | **Referenced** (`accountId`) | **High-Volume Ledger Guarantee**: Active accounts record thousands of transactions. Embedding transactions inside accounts would quickly breach MongoDB's **16MB BSON limit** and trigger severe document-level lock contention. Keeping an independent collection guarantees an **immutable append-only ledger** with efficient index pagination. |
| **`approvals`** | 1 Account $\rightarrow$ N Approvals | **Referenced** (`accountId`, `staffId`) | Compliance audit records must be decoupled from the operational state of accounts for independent audit inspection and staff performance monitoring. |

### Schema Fields & Indexing

1. **`users`**:
   - Fields: `name`, `email` (unique, indexed), `passwordHash`, `role` (`customer` / `staff` / `admin`), `kycStatus` (`pending` / `approved` / `rejected`), `kycDetails` (documentType, documentNumber, phone, address, reviewedBy, reviewedAt).
   - Indexes: `{ email: 1 }` (unique).

2. **`accounts`**:
   - Fields: `userId` (ref: User), `accountNumber` (unique 10-digit), `type` (`savings` / `current`), `balance`, `status` (`pending` / `active` / `frozen` / `rejected`), `dailyTransferLimit`, `minBalance`, timestamps.
   - Indexes: `{ userId: 1 }`, `{ accountNumber: 1 }` (unique).

3. **`beneficiaries`**:
   - Fields: `accountId` (ref: Account), `beneficiaryAccountNumber`, `nickname`, `beneficiaryName`, timestamps.
   - Indexes: `{ accountId: 1 }`, `{ accountId: 1, beneficiaryAccountNumber: 1 }` (unique).

4. **`transactions`**:
   - Fields: `accountId` (ref: Account), `type` (`debit` / `credit`), `amount`, `balanceAfter`, `relatedAccount`, `description`, `flagged` (boolean), `createdAt` (Date, immutable).
   - Indexes: `{ accountId: 1, createdAt: -1 }`, `{ flagged: 1 }`.
   - **Schema Immutability Hook**: Pre-hooks on `updateOne`, `updateMany`, `findOneAndUpdate`, `deleteOne`, `deleteMany`, `findOneAndDelete` throw HTTP 403 `TRANSACTION_IMMUTABLE`.

5. **`approvals`**:
   - Fields: `accountId` (ref: Account), `staffId` (ref: User), `decision` (`approved` / `rejected`), `remarks`, `createdAt`.
   - Indexes: `{ accountId: 1 }`.

---

## The 13 Business Logic Modules

### 1. Customer Onboarding & KYC Capture
- Public registration endpoint (`POST /api/auth/register`) captures customer identity and KYC documents (Passport, National ID, Driving License, PAN).
- Passwords are encrypted with 10-round salted bcrypt.
- Customers default to `kycStatus: 'pending'`.
- JWT token is issued upon successful registration and login (`POST /api/auth/login`).

### 2. Account Approval Workflow
- Dedicated staff-only endpoint (`POST /api/staff/accounts/:id/approval`).
- Validates the staff officer's decision (`approved` or `rejected`).
- **Conflict Prevention**: Rejects already decided accounts with HTTP 409 Conflict.
- Logs an immutable audit record in the `approvals` collection linking `accountId`, `staffId`, `decision`, and `remarks`.
- If approved with an opening balance, automatically posts the initial deposit credit ledger entry.

### 3. Account Management
- Customers can request creation of Savings or Current accounts (`POST /api/accounts`).
- **KYC Pre-requisite**: Accounts can **only** be created by KYC-approved customers (HTTP 403 otherwise).
- Auto-generates unique 10-digit account numbers (prefix `10` for Savings, `20` for Current).
- Accounts start with `status: 'pending'` awaiting staff approval.
- Enforces default minimum balances: Savings ($1,000) and Current ($5,000).

### 4. Beneficiary Management
- Customers register frequent transfer counterparties (`POST /api/beneficiaries`).
- **Ownership Enforcement**: Customers can only register beneficiaries to accounts they personally own.
- **Business Rule Checks**:
  - Rejects attempts to add one's own account as a beneficiary (HTTP 409).
  - Validates that the counterparty account exists in the bank (HTTP 404).
  - Prevents duplicate beneficiary registrations for the same account (HTTP 409).

### 5. Fund Transfer Engine
- Endpoint: `POST /api/transactions/transfer`.
- Atomic multi-document fund transfer leveraging Mongoose transactions / sessions (`session.withTransaction`).
- Validates sender ownership, active status of both accounts, sufficient available balance above `minBalance`, and daily transfer limits.
- Debits sender account, credits recipient account, and writes both immutable ledger entries in a single atomic transaction.

### 6. Transaction Ledger
- Every fund transfer generates two synchronized ledger entries:
  - Debit entry on source account (records counterparty, amount, and `balanceAfter`).
  - Credit entry on destination account (records source, amount, and `balanceAfter`).
- Read-only ledger inspection (`GET /api/transactions/account/:accountId`).
- **Strict Immutability**: No update or delete endpoints exist, backed by Mongoose pre-save/delete rejection hooks.

### 7. Account Statement Generation
- Endpoint: `GET /api/accounts/:id/statement?from=YYYY-MM-DD&to=YYYY-MM-DD`.
- Performs MongoDB aggregation pipeline to compute:
  - `openingBalance`: Sum of transactions prior to the start date.
  - `totalDebits` & `totalCredits`: Volume of debits and credits within the requested window.
  - `netFlow`: Difference between credits and debits.
  - `closingBalance`: Account balance at statement generation.
- Returns paginated chronological ledger lines.

### 8. Minimum Balance & Daily Limits Enforcement
- Seamlessly integrated inside the Transfer Engine:
  - **Minimum Balance Check**: Rejects transfers with HTTP 409 Conflict if `source.balance - amount < source.minBalance`.
  - **Daily Limit Aggregation**: Aggregates all debit transactions initiated from midnight (`00:00:00`) of the current calendar day. Rejects transfers with HTTP 409 Conflict if cumulative debits + new transfer exceed `dailyTransferLimit`.

### 9. Suspicious Transaction Flagging
- Real-time Anti-Money Laundering (AML) monitoring rule.
- If transfer `amount >= SUSPICIOUS_THRESHOLD` (configurable via `.env`, default: $50,000), the system automatically flags the transaction (`flagged: true`).
- Flagged status is recorded on the immutable ledger entry for compliance auditing.

### 10. Account Freeze / Unfreeze
- Staff-only administrative controls:
  - `PATCH /api/staff/accounts/:id/freeze`
  - `PATCH /api/staff/accounts/:id/unfreeze`
- **Enforcement**: Any transfer attempt involving a frozen account is blocked with HTTP 403 Forbidden.

### 11. Interest Calculation Job Logic
- Automated interest calculation engine (`POST /api/staff/jobs/calculate-interest`).
- Discovers all active Savings accounts with positive balances.
- Calculates simple interest:
  $$\text{Interest} = \text{Balance} \times \left(\text{AnnualRate} \times \frac{\text{PeriodDays}}{365}\right)$$
- Credits calculated interest directly to account balances and posts immutable ledger records categorized as `SYSTEM_INTEREST`.

### 12. Staff Monitoring Dashboard
- Endpoints for bank staff oversight:
  - `GET /api/staff/flagged-transactions`: Filtered list of transactions flagged for AML review with populated customer profiles.
  - `GET /api/staff/pending-approvals`: Pipeline of accounts awaiting review.
  - `GET /api/staff/dashboard-stats`: Executive overview of total deposits, active/frozen accounts, and pending KYC reviews.

### 13. Role-Based Access Control & User Administration
- Tiered RBAC: `Customer`, `Bank Staff`, and `Admin`.
- Middleware:
  - `authenticate`: Validates bearer token.
  - `authorize(...roles)`: Verifies role permissions.
  - `requireAccountOwnership`: Validates customer ID against the account's `userId`.
- Admin endpoints:
  - `POST /api/admin/staff`: Admin provisions staff or fellow admin accounts.
  - `GET /api/admin/users`: User directory with role and KYC filters.
  - `PATCH /api/admin/users/:id/role`: Role escalation/delegation.
  - `PATCH /api/admin/users/:id/kyc`: KYC status updates.

---

## API Endpoint Matrix

| Method | Endpoint | Allowed Roles | Description | Expected Status Codes |
| :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/auth/register` | Public | Register customer with KYC details | 201, 400, 409 |
| **POST** | `/api/auth/login` | Public | Login with email and password | 200, 400, 401 |
| **GET** | `/api/auth/profile` | Authenticated | Fetch authenticated user profile | 200, 401 |
| **POST** | `/api/accounts` | Customer | Create savings/current account (KYC approved) | 201, 400, 403 |
| **GET** | `/api/accounts` | All Roles | List user accounts (Customer) / All (Staff/Admin) | 200, 401 |
| **GET** | `/api/accounts/:id` | Owner / Staff | Get detailed account information | 200, 401, 403, 404 |
| **GET** | `/api/accounts/:id/statement` | Owner / Staff | Generate statement with date filters | 200, 400, 401, 403, 404 |
| **GET** | `/api/accounts/:id/approvals` | Owner / Staff | View account approval history | 200, 401, 403, 404 |
| **POST** | `/api/staff/accounts/:id/approval`| Staff, Admin | Approve or reject pending account | 200, 400, 401, 403, 404, 409 |
| **PATCH** | `/api/staff/accounts/:id/freeze` | Staff, Admin | Freeze a bank account | 200, 401, 403, 404, 409 |
| **PATCH** | `/api/staff/accounts/:id/unfreeze`| Staff, Admin | Unfreeze a bank account | 200, 401, 403, 404, 409 |
| **GET** | `/api/staff/pending-approvals` | Staff, Admin | View all accounts pending approval | 200, 401, 403 |
| **GET** | `/api/staff/flagged-transactions` | Staff, Admin | View AML flagged suspicious transfers | 200, 401, 403 |
| **GET** | `/api/staff/dashboard-stats` | Staff, Admin | Get bank dashboard metrics | 200, 401, 403 |
| **POST** | `/api/staff/jobs/calculate-interest`| Staff, Admin | Execute savings interest calculation | 200, 400, 401, 403 |
| **PATCH** | `/api/staff/users/:id/kyc` | Staff, Admin | Review and update user KYC status | 200, 400, 401, 403, 404 |
| **POST** | `/api/beneficiaries` | Customer | Register a beneficiary on owned account | 201, 400, 401, 403, 404, 409 |
| **GET** | `/api/beneficiaries` | All Roles | List registered beneficiaries | 200, 401, 403 |
| **DELETE**| `/api/beneficiaries/:id` | Customer | Remove a registered beneficiary | 200, 401, 403, 404 |
| **POST** | `/api/transactions/transfer` | Customer | Atomic fund transfer between accounts | 201, 400, 401, 403, 404, 409 |
| **GET** | `/api/transactions/account/:accountId` | Owner / Staff | View immutable account ledger | 200, 401, 403, 404 |
| **POST** | `/api/admin/staff` | Admin | Provision staff or admin user | 201, 400, 401, 403, 409 |
| **GET** | `/api/admin/users` | Admin | Directory of all users with filters | 200, 401, 403 |
| **PATCH** | `/api/admin/users/:id/role` | Admin | Update user role (customer/staff/admin)| 200, 400, 401, 403, 404, 409 |

---

## Response Convention & Error Handling

All responses strictly follow standard JSON envelopes:

### Success Response Envelope
```json
{
  "success": true,
  "message": "Operation completed successfully.",
  "data": { ... }
}
```

### Error Response Envelope
```json
{
  "success": false,
  "message": "Human-readable explanation of error condition.",
  "errorCode": "MACHINE_READABLE_ERROR_CODE"
}
```

### Standard HTTP Status Codes
- **`200 OK`**: Successful query, update, or action.
- **`201 Created`**: Successful entity creation (user, account, transfer, beneficiary).
- **`400 Bad Request`**: Joi validation failure, invalid ObjectID, or malformed payload.
- **`401 Unauthorized`**: Missing, expired, or invalid JWT token.
- **`403 Forbidden`**: Role authorization failure, account ownership denied, or action on frozen account.
- **`404 Not Found`**: Resource does not exist.
- **`409 Conflict`**: Business rule conflict (duplicate entry, minimum balance breach, daily transfer limit exceeded, re-approval of decided account).
- **`500 Internal Server Error`**: Unexpected server exception.

---

## Setup & Execution Instructions

### Prerequisites
- Node.js version 18.x or 20.x installed.
- MongoDB instance running locally on port 27017 (or MongoDB Atlas connection string).

### 1. Installation
Clone the repository and install all dependencies:
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file from the provided `.env.example`:
```bash
cp .env.example .env
```
Default configuration values:
```env
PORT=5001
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/digital_banking_db
JWT_SECRET=super_secret_jwt_key_academic_cia3_banking_app_2026
JWT_EXPIRES_IN=1d

# Banking Logic Settings
SUSPICIOUS_THRESHOLD=50000
SAVINGS_ANNUAL_INTEREST_RATE=0.04
DEFAULT_SAVINGS_MIN_BALANCE=1000
DEFAULT_CURRENT_MIN_BALANCE=5000
DEFAULT_SAVINGS_DAILY_LIMIT=50000
DEFAULT_CURRENT_DAILY_LIMIT=200000
```

### 3. Database Seeding (Pre-configured Test Users)
Populate realistic initial bank accounts and users:
```bash
npm run seed
```
**Seed Accounts Available Immediately:**
| Role | Email | Password | Details |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@bank.com` | `Password123!` | System administrator |
| **Staff** | `staff@bank.com` | `Password123!` | Bank compliance officer |
| **Customer** | `alice@customer.com` | `Password123!` | Active Savings (`1088991001` - $25,000) & Current (`2088991002` - $80,000) |
| **Customer** | `bob@customer.com` | `Password123!` | Active Savings (`1099222001` - $15,000) |
| **Customer** | `charlie@customer.com`| `Password123!`| Pending KYC status |
| **Customer** | `david@customer.com` | `Password123!` | Has Pending Account (`1033443001` - $5,000) |
| **Customer** | `eve@customer.com` | `Password123!` | Has Frozen Account (`1055665001` - $12,000) |

### 4. Running the Application
To start in development mode with auto-reload:
```bash
npm run dev
```
To start in production mode:
```bash
npm start
```
The server will boot on `http://localhost:5001`. Verify health at:
```bash
curl http://localhost:5001/api/health
```

### 5. Interactive Web Frontend Portal
Open your browser and navigate directly to:
👉 **`http://localhost:5001/`**

The interactive portal features:
- **One-Click Demo Personas**: Instantly authenticate as Alice, Bob, Charlie (KYC pending), Bank Staff Officer, or Super Admin.
- **Customer Banking Center**: Real-time accounts, atomic fund transfers, beneficiary management, and account statements with financial aggregation.
- **Staff Operations & Compliance**: Account approval/rejection pipeline with remarks, AML flagged transaction monitor, account freeze/unfreeze controls, and savings interest calculation.
- **Admin & RBAC**: User directory, staff provisioning, and role delegation.
- **Live API Inspector**: Real-time display of outgoing request payloads, HTTP response status codes, and backend JSON response envelopes.

---

## Automated Testing

The project includes an automated test suite with **33 integration tests** spanning all 13 modules using Jest, Supertest, and `mongodb-memory-server` (in-memory MongoDB instance with zero external dependencies).

To run the test suite:
```bash
npm test
```

### Test Coverage Highlights:
- **Customer Onboarding**: Validation, bcrypt hashing verification, JWT generation, duplicate email rejection.
- **KYC & Account Workflow**: Block unapproved KYC, account creation in `pending` status, staff approval, duplicate approval prevention (409 Conflict).
- **Ownership Verification**: Customer 2 accessing Customer 1 account blocked with 403 Forbidden.
- **Beneficiaries**: Validation, ownership rules, self-account rejection, duplicate rejection.
- **Fund Transfer Engine**: Atomic balance update, simultaneous credit and debit ledger records, minimum balance breaches, daily transfer limit breaches.
- **AML Flagging**: Automatic `flagged: true` for amounts $\ge \$50,000$.
- **Immutability Enforcement**: Direct mutation attempts on ledger records blocked by schema hooks.
- **Account Freeze**: Staff freeze, rejection of transfers on frozen accounts (403 Forbidden), staff unfreeze.
- **Interest Calculation**: Mathematical precision verification of savings interest credit and ledger posting.
- **Dashboard & RBAC**: Privilege segregation between Customers, Staff, and Admins.

---

## Postman Collection Usage

The file **`Digital_Banking_API.postman_collection.json`** is exported in Postman v2.1.0 format in the project root.

### Features:
- Pre-configured requests organized across 10 functional folders.
- Automatic token extraction: Logging in updates collection variables (`adminToken`, `staffToken`, `customer1Token`) automatically via Postman test scripts.
- Systematic coverage of HTTP status codes:
  - **Happy Path** (200 / 201)
  - **Validation Failure** (400)
  - **Unauthenticated** (401)
  - **Forbidden / Ownership Denied** (403)
  - **Not Found** (404)
  - **Business Conflict** (409)

### How to Import:
1. Open Postman $\rightarrow$ Click **Import** $\rightarrow$ Select `Digital_Banking_API.postman_collection.json`.
2. Ensure the `baseUrl` variable is set to `http://localhost:5001`.
3. Execute `1.6 Login Admin`, `1.5 Login Staff`, and `1.4 Login Customer` to automatically populate auth tokens.
4. Run requests sequentially or use Postman Collection Runner.

---

## Known Limitations & Production Considerations

1. **Standalone MongoDB vs. Replica Set Transactions**:
   - Multi-document ACID transactions via `session.withTransaction()` natively require a MongoDB replica set.
   - For developer convenience, `utils/transactionSessionHelper.js` includes an intelligent detection mechanism: when connected to a standalone single MongoDB node (e.g. standard local test installs), it logs a warning and falls back to sequenced atomic balance operations. In production clusters or replica set deployments, full ACID distributed transactions are seamlessly utilized.
2. **Currency Precision**:
   - Monies are represented as double-precision numbers rounded to 2 decimal places. For Tier-1 production core banking systems, using MongoDB's `Decimal128` type is recommended to eliminate floating-point rounding anomalies across millions of transactions.
3. **Scheduled Interest Cron**:
   - Module 11 provides an on-demand API endpoint (`POST /api/staff/jobs/calculate-interest`) which can be executed via external cron services or internal schedulers (such as `node-cron` or Agenda). In distributed multi-instance deployments, a distributed mutex (e.g. Redlock) should guard the cron job to prevent duplicate interest credit executions.
# Banking-Software
