/**
 * Aurum Digital Banking Portal - Client Application
 * Academic CIA-3 Frontend Interface
 */

const API_BASE = '/api';

// Current session state
let currentToken = null;
let currentUser = null;
let activePersonaKey = 'alice';

// Demo credentials
const PERSONAS = {
  alice: { email: 'alice@customer.com', password: 'Password123!', label: 'Alice (Customer)' },
  bob: { email: 'bob@customer.com', password: 'Password123!', label: 'Bob (Customer)' },
  charlie: { email: 'charlie@customer.com', password: 'Password123!', label: 'Charlie (KYC Pending)' },
  staff: { email: 'staff@bank.com', password: 'Password123!', label: 'Staff Officer' },
  admin: { email: 'admin@bank.com', password: 'Password123!', label: 'Super Admin' },
};

// =========================================================
// API Fetch Helper & Live Inspector
// =========================================================
async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (currentToken) {
    headers['Authorization'] = `Bearer ${currentToken}`;
  }

  const method = options.method || 'GET';
  const startTime = Date.now();

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const elapsed = Date.now() - startTime;
    const data = await res.json();

    // Update Live API Inspector
    updateInspector(method, endpoint, options.body ? JSON.parse(options.body) : null, res.status, data, elapsed);

    if (!res.ok) {
      throw new Error(data.message || `Request failed with status ${res.status}`);
    }

    return data;
  } catch (error) {
    showToast(error.message, 'danger');
    throw error;
  }
}

function updateInspector(method, endpoint, requestBody, status, responseBody, elapsed) {
  const inspectorBody = document.getElementById('inspectorBody');
  const inspectorStatus = document.getElementById('inspectorStatus');

  inspectorStatus.textContent = `HTTP ${status} (${elapsed}ms)`;
  inspectorStatus.className = `status-badge ${status < 400 ? 'active' : 'frozen'}`;

  const logPayload = {
    request: {
      method,
      endpoint,
      payload: requestBody,
    },
    response: {
      status,
      envelope: responseBody,
    },
  };

  inspectorBody.textContent = JSON.stringify(logPayload, null, 2);
}

// =========================================================
// Toast Notification Engine
// =========================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span style="font-size: 1.1rem;">${type === 'success' ? '✓' : type === 'danger' ? '✕' : 'ℹ'}</span>
    <span style="font-size: 0.85rem; font-weight: 500;">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

// =========================================================
// Persona Authentication & Navigation Tabs
// =========================================================
async function switchPersona(personaKey) {
  activePersonaKey = personaKey;
  const persona = PERSONAS[personaKey];

  document.querySelectorAll('.persona-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.textContent.toLowerCase().includes(personaKey));
  });

  try {
    const res = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: persona.email, password: persona.password }),
    });

    currentToken = res.data.token;
    currentUser = res.data.user;

    // Update Header UI
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userAvatar').textContent = currentUser.name.charAt(0);
    document.getElementById('userRole').textContent = `${currentUser.role.toUpperCase()} • KYC ${currentUser.kycStatus.toUpperCase()}`;

    showToast(`Logged in as ${currentUser.name} (${currentUser.role})`, 'success');

    // Build role-appropriate navigation tabs
    renderNavTabs();
  } catch (error) {
    showToast(`Failed to authenticate ${persona.label}: ${error.message}`, 'danger');
  }
}

function renderNavTabs() {
  const navTabsContainer = document.getElementById('navTabs');
  navTabsContainer.innerHTML = '';

  let tabs = [];

  if (currentUser.role === 'customer') {
    tabs = [
      { id: 'view-customer-accounts', label: 'My Accounts', icon: '💳', handler: loadCustomerAccounts },
      { id: 'view-customer-transfer', label: 'Fund Transfer', icon: '⚡', handler: setupTransferView },
      { id: 'view-customer-beneficiaries', label: 'Beneficiaries', icon: '👥', handler: loadBeneficiaries },
      { id: 'view-customer-statement', label: 'Statement & Ledger', icon: '📜', handler: setupStatementView },
    ];
  } else if (currentUser.role === 'staff' || currentUser.role === 'admin') {
    tabs = [
      { id: 'view-staff-dashboard', label: 'Staff Dashboard', icon: '📊', handler: loadStaffDashboard },
      { id: 'view-staff-approvals', label: 'Pending Approvals', icon: '⏳', handler: loadPendingApprovals },
      { id: 'view-staff-aml', label: 'AML Flags Monitor', icon: '🚩', handler: loadAmlTransactions },
      { id: 'view-staff-freeze', label: 'Freeze Controls', icon: '🔒', handler: loadAllAccountsForFreeze },
    ];

    if (currentUser.role === 'admin') {
      tabs.push({ id: 'view-admin-users', label: 'Admin Directory', icon: '⚙️', handler: loadAdminUsers });
    }
  }

  tabs.forEach((tab, index) => {
    const btn = document.createElement('button');
    btn.className = `nav-tab ${index === 0 ? 'active' : ''}`;
    btn.innerHTML = `<span>${tab.icon}</span> <span>${tab.label}</span>`;
    btn.onclick = () => {
      document.querySelectorAll('.nav-tab').forEach((t) => t.classList.remove('active'));
      btn.classList.add('active');

      document.querySelectorAll('.view-section').forEach((v) => v.classList.remove('active'));
      const activeSection = document.getElementById(tab.id);
      if (activeSection) activeSection.classList.add('active');

      tab.handler();
    };
    navTabsContainer.appendChild(btn);
  });

  // Trigger first tab
  if (tabs.length > 0) {
    document.querySelectorAll('.view-section').forEach((v) => v.classList.remove('active'));
    const firstSection = document.getElementById(tabs[0].id);
    if (firstSection) firstSection.classList.add('active');
    tabs[0].handler();
  }
}

// =========================================================
// Customer Views: Accounts, Transfers, Beneficiaries, Statements
// =========================================================
async function loadCustomerAccounts() {
  try {
    const res = await apiCall('/accounts');
    const container = document.getElementById('accountsGrid');
    container.innerHTML = '';

    const accounts = res.data.accounts || [];

    if (accounts.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <p>No bank accounts found for this profile.</p>
          <button class="btn btn-primary" style="margin-top: 1rem;" onclick="openNewAccountModal()">Apply to Open Account</button>
        </div>
      `;
      return;
    }

    accounts.forEach((acc) => {
      const card = document.createElement('div');
      card.className = `account-card ${acc.type}`;
      card.innerHTML = `
        <div class="account-top">
          <span class="account-chip ${acc.type}">${acc.type} account</span>
          <span class="status-badge ${acc.status}">${acc.status}</span>
        </div>
        <div class="account-number">
          <span>A/C:</span>
          <strong>${acc.accountNumber}</strong>
        </div>
        <div class="account-balance-label">Available Ledger Balance</div>
        <div class="account-balance">$${acc.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        <div class="account-details-row">
          <span>Min Required: $${acc.minBalance.toLocaleString()}</span>
          <span>Daily Limit: $${acc.dailyTransferLimit.toLocaleString()}</span>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to load accounts:', err);
  }
}

async function setupTransferView() {
  try {
    const res = await apiCall('/accounts');
    const select = document.getElementById('transferSourceAccount');
    select.innerHTML = '';

    const activeAccounts = (res.data.accounts || []).filter((acc) => acc.status === 'active');

    if (activeAccounts.length === 0) {
      select.innerHTML = '<option value="">No active accounts available for transfer</option>';
      document.getElementById('transferSubmitBtn').disabled = true;
      return;
    }

    document.getElementById('transferSubmitBtn').disabled = false;
    activeAccounts.forEach((acc) => {
      const opt = document.createElement('option');
      opt.value = acc._id;
      opt.textContent = `${acc.accountNumber} (${acc.type.toUpperCase()}) — Balance: $${acc.balance.toLocaleString()}`;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error('Failed to setup transfer view:', err);
  }
}

async function handleTransferSubmit(e) {
  e.preventDefault();
  const sourceAccountId = document.getElementById('transferSourceAccount').value;
  const destinationAccountNumber = document.getElementById('transferDestinationNumber').value.trim();
  const amount = Number(document.getElementById('transferAmount').value);
  const description = document.getElementById('transferDescription').value.trim();

  try {
    const res = await apiCall('/transactions/transfer', {
      method: 'POST',
      body: JSON.stringify({
        sourceAccountId,
        destinationAccountNumber,
        amount,
        description,
      }),
    });

    showToast(res.message, res.data?.transfer?.flagged ? 'warning' : 'success');
    document.getElementById('transferForm').reset();
    setupTransferView();
  } catch (err) {
    // Error already toasted by apiCall
  }
}

async function loadBeneficiaries() {
  try {
    const res = await apiCall('/beneficiaries');
    const tbody = document.getElementById('beneficiariesTableBody');
    tbody.innerHTML = '';

    const beneficiaries = res.data.beneficiaries || [];

    if (beneficiaries.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No beneficiaries registered yet.</td></tr>`;
      return;
    }

    beneficiaries.forEach((b) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${b.beneficiaryName}</strong></td>
        <td>${b.nickname}</td>
        <td class="mono-cell">${b.beneficiaryAccountNumber}</td>
        <td>${b.accountId?.accountNumber || 'Primary'}</td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="handleDeleteBeneficiary('${b._id}')">Remove</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load beneficiaries:', err);
  }
}

async function handleDeleteBeneficiary(id) {
  if (!confirm('Remove this beneficiary?')) return;
  try {
    const res = await apiCall(`/beneficiaries/${id}`, { method: 'DELETE' });
    showToast(res.message, 'success');
    loadBeneficiaries();
  } catch (err) {
    console.error('Failed to delete beneficiary:', err);
  }
}

async function setupStatementView() {
  try {
    const res = await apiCall('/accounts');
    const select = document.getElementById('statementAccountSelect');
    select.innerHTML = '';

    const accounts = res.data.accounts || [];
    accounts.forEach((acc) => {
      const opt = document.createElement('option');
      opt.value = acc._id;
      opt.textContent = `${acc.accountNumber} (${acc.type.toUpperCase()}) — $${acc.balance.toLocaleString()}`;
      select.appendChild(opt);
    });

    if (accounts.length > 0) {
      fetchStatement();
    }
  } catch (err) {
    console.error('Failed to setup statement view:', err);
  }
}

async function fetchStatement() {
  const accountId = document.getElementById('statementAccountSelect').value;
  if (!accountId) return;

  const from = document.getElementById('statementFromDate').value;
  const to = document.getElementById('statementToDate').value;

  let query = '';
  if (from) query += `&from=${from}`;
  if (to) query += `&to=${to}`;

  try {
    const res = await apiCall(`/accounts/${accountId}/statement?limit=50${query}`);
    const { statement } = res.data;

    // Show summary cards
    document.getElementById('statementSummaryGrid').style.display = 'grid';
    document.getElementById('statementOpening').textContent = `$${statement.summary.openingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    document.getElementById('statementCredits').textContent = `+$${statement.summary.totalCredits.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    document.getElementById('statementDebits').textContent = `-$${statement.summary.totalDebits.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    document.getElementById('statementClosing').textContent = `$${statement.summary.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    const tbody = document.getElementById('statementTableBody');
    tbody.innerHTML = '';

    const txs = statement.transactions || [];
    if (txs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No transaction records found for this period.</td></tr>`;
      return;
    }

    txs.forEach((tx) => {
      const tr = document.createElement('tr');
      const isDebit = tx.type === 'debit';
      tr.innerHTML = `
        <td style="color: var(--text-dim); font-size: 0.8rem;">${new Date(tx.createdAt).toLocaleString()}</td>
        <td><span class="status-badge ${isDebit ? 'frozen' : 'active'}">${tx.type.toUpperCase()}</span></td>
        <td class="mono-cell">${tx.relatedAccount}</td>
        <td>${tx.description || 'Transfer'}</td>
        <td class="${isDebit ? 'amount-debit' : 'amount-credit'}">
          ${isDebit ? '-' : '+'}$${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </td>
        <td class="mono-cell">$${tx.balanceAfter.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        <td>
          ${tx.flagged ? '<span class="status-badge frozen">FLAGGED AML</span>' : '<span style="color: var(--text-dim);">—</span>'}
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to generate statement:', err);
  }
}

// =========================================================
// Staff Views: Dashboard, Approvals, AML, Freeze Controls
// =========================================================
async function loadStaffDashboard() {
  try {
    const res = await apiCall('/staff/dashboard-stats');
    const { stats } = res.data;

    document.getElementById('staffTotalDeposits').textContent = `$${stats.financials.totalSystemDeposits.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    document.getElementById('staffPendingCount').textContent = stats.accounts.pending;
    document.getElementById('staffFlaggedCount').textContent = stats.risk.flaggedTransactions;
    document.getElementById('staffKycCount').textContent = stats.kyc.pendingCustomers;
  } catch (err) {
    console.error('Failed to load staff stats:', err);
  }
}

async function loadPendingApprovals() {
  try {
    const res = await apiCall('/staff/pending-approvals');
    const tbody = document.getElementById('pendingApprovalsTableBody');
    tbody.innerHTML = '';

    const accounts = res.data.accounts || [];

    if (accounts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No pending account approvals currently awaiting review.</td></tr>`;
      return;
    }

    accounts.forEach((acc) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="mono-cell"><strong>${acc.accountNumber}</strong></td>
        <td>${acc.userId?.name || 'Applicant'}</td>
        <td>${acc.userId?.email || '—'}</td>
        <td><span class="account-chip ${acc.type}">${acc.type}</span></td>
        <td class="mono-cell">$${acc.balance.toLocaleString()}</td>
        <td><span class="status-badge pending">PENDING</span></td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="openDecideModal('${acc._id}', '${acc.accountNumber}', '${acc.userId?.name || 'Applicant'}')">Review & Decide</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load pending approvals:', err);
  }
}

function openDecideModal(id, accNum, name) {
  document.getElementById('decideAccountId').value = id;
  document.getElementById('decideAccountDetails').textContent = `Evaluating application for account ${accNum} belonging to ${name}.`;
  openModal('modalDecideAccount');
}

async function handleAccountDecisionSubmit(e) {
  e.preventDefault();
  const accountId = document.getElementById('decideAccountId').value;
  const decision = document.getElementById('decideDecision').value;
  const remarks = document.getElementById('decideRemarks').value.trim();

  try {
    const res = await apiCall(`/staff/accounts/${accountId}/approval`, {
      method: 'POST',
      body: JSON.stringify({ decision, remarks }),
    });

    showToast(res.message, 'success');
    closeModal('modalDecideAccount');
    loadPendingApprovals();
  } catch (err) {
    // Toasted
  }
}

async function loadAmlTransactions() {
  try {
    const res = await apiCall('/staff/flagged-transactions');
    const tbody = document.getElementById('amlTableBody');
    tbody.innerHTML = '';

    const txs = res.data.transactions || [];

    if (txs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No suspicious transactions currently flagged.</td></tr>`;
      return;
    }

    txs.forEach((tx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="color: var(--text-dim); font-size: 0.8rem;">${new Date(tx.createdAt).toLocaleString()}</td>
        <td class="mono-cell">${tx.accountId?.accountNumber || '—'}</td>
        <td>${tx.accountId?.userId?.name || 'Account Holder'}</td>
        <td class="amount-debit" style="font-size: 1rem;">$${tx.amount.toLocaleString()}</td>
        <td>${tx.type.toUpperCase()}</td>
        <td class="mono-cell">${tx.relatedAccount}</td>
        <td><span class="status-badge frozen">AML SUSPICIOUS (≥$50k)</span></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load AML transactions:', err);
  }
}

async function loadAllAccountsForFreeze() {
  try {
    const res = await apiCall('/accounts');
    const tbody = document.getElementById('allAccountsTableBody');
    tbody.innerHTML = '';

    const accounts = res.data.accounts || [];

    accounts.forEach((acc) => {
      const tr = document.createElement('tr');
      const isFrozen = acc.status === 'frozen';
      tr.innerHTML = `
        <td class="mono-cell"><strong>${acc.accountNumber}</strong></td>
        <td>${acc.userId?.name || 'Customer'}</td>
        <td><span class="account-chip ${acc.type}">${acc.type}</span></td>
        <td class="mono-cell">$${acc.balance.toLocaleString()}</td>
        <td><span class="status-badge ${acc.status}">${acc.status.toUpperCase()}</span></td>
        <td>
          ${
            isFrozen
              ? `<button class="btn btn-success btn-sm" onclick="toggleFreeze('${acc._id}', 'unfreeze')">Unfreeze Account</button>`
              : `<button class="btn btn-danger btn-sm" onclick="toggleFreeze('${acc._id}', 'freeze')">Freeze Account</button>`
          }
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load accounts for freeze view:', err);
  }
}

async function toggleFreeze(id, action) {
  if (!confirm(`Are you sure you want to ${action} this account?`)) return;

  try {
    const res = await apiCall(`/staff/accounts/${id}/${action}`, {
      method: 'PATCH',
      body: JSON.stringify({ reason: 'Compliance administrative action' }),
    });

    showToast(res.message, 'success');
    loadAllAccountsForFreeze();
  } catch (err) {
    // Toasted
  }
}

async function handleInterestJobSubmit(e) {
  e.preventDefault();
  const annualRate = Number(document.getElementById('interestRate').value);
  const periodDays = Number(document.getElementById('interestPeriodDays').value);

  try {
    const res = await apiCall('/staff/jobs/calculate-interest', {
      method: 'POST',
      body: JSON.stringify({ annualRate, periodDays }),
    });

    showToast(`Interest calculation complete: $${res.data.summary.totalInterestCredited} credited across ${res.data.summary.accountsCredited} accounts.`, 'success');
    closeModal('modalInterestJob');
  } catch (err) {
    // Toasted
  }
}

// =========================================================
// Admin Views: Users, Staff Provisioning, KYC Review
// =========================================================
async function loadAdminUsers() {
  try {
    const res = await apiCall('/admin/users');
    const tbody = document.getElementById('adminUsersTableBody');
    tbody.innerHTML = '';

    const users = res.data.users || [];

    users.forEach((u) => {
      const tr = document.createElement('tr');
      const isKycApproved = u.kycStatus === 'approved';
      tr.innerHTML = `
        <td><strong>${u.name}</strong></td>
        <td>${u.email}</td>
        <td><span class="status-badge ${u.role === 'admin' ? 'frozen' : u.role === 'staff' ? 'info' : 'active'}">${u.role.toUpperCase()}</span></td>
        <td><span class="status-badge ${u.kycStatus}">${u.kycStatus.toUpperCase()}</span></td>
        <td style="font-size: 0.8rem; color: var(--text-dim);">
          ${u.kycDetails?.documentType || 'None'}: ${u.kycDetails?.documentNumber || '—'}
        </td>
        <td>
          ${
            !isKycApproved
              ? `<button class="btn btn-success btn-sm" onclick="updateKycStatus('${u._id}', 'approved')">Approve KYC</button>`
              : `<button class="btn btn-secondary btn-sm" onclick="updateKycStatus('${u._id}', 'rejected')">Revoke KYC</button>`
          }
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load admin users:', err);
  }
}

async function updateKycStatus(userId, status) {
  try {
    const res = await apiCall(`/staff/users/${userId}/kyc`, {
      method: 'PATCH',
      body: JSON.stringify({ kycStatus: status, remarks: 'Administrative decision via portal' }),
    });

    showToast(res.message, 'success');
    loadAdminUsers();
  } catch (err) {
    // Toasted
  }
}

async function handleCreateStaffSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('staffName').value.trim();
  const email = document.getElementById('staffEmail').value.trim();
  const password = document.getElementById('staffPassword').value;
  const role = document.getElementById('staffRole').value;

  try {
    const res = await apiCall('/admin/staff', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role }),
    });

    showToast(res.message, 'success');
    closeModal('modalCreateStaff');
    loadAdminUsers();
  } catch (err) {
    // Toasted
  }
}

// =========================================================
// Modals Helpers
// =========================================================
function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('active');
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('active');
}

function openNewAccountModal() { openModal('modalNewAccount'); }
function openAddBeneficiaryModal() {
  // Populate beneficiary source accounts
  apiCall('/accounts').then((res) => {
    const select = document.getElementById('beneficiarySourceAccount');
    select.innerHTML = '';
    (res.data.accounts || []).forEach((acc) => {
      const opt = document.createElement('option');
      opt.value = acc._id;
      opt.textContent = `${acc.accountNumber} (${acc.type.toUpperCase()})`;
      select.appendChild(opt);
    });
    openModal('modalAddBeneficiary');
  });
}
function fillBeneficiaryQuick(accNum, name, nickname) {
  document.getElementById('beneficiaryAccountNumber').value = accNum;
  document.getElementById('beneficiaryFullName').value = name;
  document.getElementById('beneficiaryNickname').value = nickname;
}
function openInterestModal() { openModal('modalInterestJob'); }
function openCreateStaffModal() { openModal('modalCreateStaff'); }

async function handleNewAccountSubmit(e) {
  e.preventDefault();
  const type = document.getElementById('newAccountType').value;
  const initialDeposit = Number(document.getElementById('newAccountDeposit').value);

  try {
    const res = await apiCall('/accounts', {
      method: 'POST',
      body: JSON.stringify({ type, initialDeposit }),
    });

    showToast(res.message, 'success');
    closeModal('modalNewAccount');
    loadCustomerAccounts();
  } catch (err) {
    // Toasted
  }
}

async function handleAddBeneficiarySubmit(e) {
  e.preventDefault();
  const accountId = document.getElementById('beneficiarySourceAccount').value;
  const beneficiaryAccountNumber = document.getElementById('beneficiaryAccountNumber').value.trim();
  const beneficiaryName = document.getElementById('beneficiaryFullName').value.trim();
  const nickname = document.getElementById('beneficiaryNickname').value.trim();

  try {
    const res = await apiCall('/beneficiaries', {
      method: 'POST',
      body: JSON.stringify({
        accountId,
        beneficiaryAccountNumber,
        beneficiaryName,
        nickname,
      }),
    });

    showToast(res.message, 'success');
    closeModal('modalAddBeneficiary');
    loadBeneficiaries();
  } catch (err) {
    // Toasted
  }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  switchPersona('alice');
});
