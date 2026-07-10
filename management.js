// =================================================================
// FILE: management.js  
// Description: Garage Management Console — full logic
// Auth: PIN-based via auth.js (no Firebase email/password)
// =================================================================

// ========== UTILITY FUNCTIONS ==========
// NOTE: kept the original function name (getUTCDateString) so every call site
// across the file keeps working untouched, but it now returns the LOCAL
// calendar date (YYYY-MM-DD) instead of the UTC date.
//
// Why this matters: the old version used date.toISOString(), which is always
// UTC. For any garage east of UTC (e.g. Kenya, UTC+3), every transaction
// logged after 21:00 local time was silently stamped with TOMORROW's date —
// so it vanished from "Today's Transactions" the instant it was saved. This
// was the main cause of transactions appearing to "disappear".
function getUTCDateString(date = new Date()) {
    const year  = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day   = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function cleanPhoneNumber(phone) {
    let cleaned = phone.replace(/[^\d+]/g, '');
    if (!cleaned.startsWith('+')) {
        cleaned = cleaned.replace(/\D/g, '');
    }
    return cleaned;
}

// Debounce flags
let isSavingJob = false;
let isSavingGeneral = false;
let isSavingPart = false;
let isSavingSale = false;
let isSavingInvoice = false;
let isSavingQuote = false;

// =================================================================
// 0. MODULE IMPORTS
// =================================================================
import {
    getBranding,
    drawPdfHeader,
    drawPdfFooter,
    loadBrandingForm,
    saveBrandingSettings,
    updateColorPreviews
} from './garage-branding.js';

import {
    getSession,
    setSession,
    clearSession,
    can,
    verifyPin,
    showTrialBanner,
    ROLES,
    savePins,
    PERMISSIONS,
    garageCol,
    garageDoc,      // ← add this
    garageRef       // optional, but good to have
} from './auth.js';

// Expose branding functions globally
window.saveBrandingSettings = saveBrandingSettings;
window.updateColorPreviews  = updateColorPreviews;

// =================================================================
// 1. FIREBASE INITIALIZATION
// =================================================================
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
    getFirestore,
    collection,
    doc,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    writeBatch,
    runTransaction,
    serverTimestamp,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBCvFltNyGj3SYR-ADUocWD5EVjljoCEp8",
    authDomain: "garage-manager-1ac7c.firebaseapp.com",
    projectId: "garage-manager-1ac7c",
    storageBucket: "garage-manager-1ac7c.firebasestorage.app",
    messagingSenderId: "226684256206",
    appId: "1:226684256206:web:13d600d6db4c603506759f"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db  = getFirestore(app);

// Collection references resolved lazily after login (garageCode not available at module load)
function getDailyTransactionsRef() { return garageCol(db, collection, 'dailyTransactions'); }
function getPastReportsRef()       { return garageCol(db, collection, 'financialReports'); }
function getSuppliersRef()         { return garageCol(db, collection, 'suppliers'); }
function getPartsInventoryRef()    { return garageCol(db, collection, 'partsInventory'); }
function getInvoicesRef()          { return garageCol(db, collection, 'invoices'); }
function getReceiptsRef()          { return garageCol(db, collection, 'receipts'); }
function getQuotesRef()            { return garageCol(db, collection, 'quotes'); }
function getInventoryLedgerRef()   { return garageCol(db, collection, 'inventoryLedger'); }
function getPartsRequisitionsRef() { return garageCol(db, collection, 'partsRequisitions'); }
function getPendingInventoryRef()  { return garageCol(db, collection, 'pendingInventory'); }
function getEmployeesRef()         { return garageCol(db, collection, 'employees'); }
function getPayrollRunsRef()       { return garageCol(db, collection, 'payrollRuns'); }
function getCasualWorkersRef()     { return garageCol(db, collection, 'casualWorkers'); }
function getCasualEarningsRef()    { return garageCol(db, collection, 'casualEarnings'); }

// UI Elements
const authSection      = document.getElementById('auth-section-management');
const dashboardSection = document.getElementById('management-dashboard');
const loginBtn         = document.getElementById('managementLoginBtn');
const logoutBtn        = document.getElementById('managementLogoutBtn');
const authMessage      = document.getElementById('management-auth-message');
const tabNav           = document.getElementById('tab-nav');
const tabContents      = document.querySelectorAll('.tab-content');

// Finance UI Elements
const jobForm                = document.getElementById('finance-job-form');
const jobIncomeInput         = document.getElementById('job-income');
const jobExpenseInput        = document.getElementById('job-expense');
const jobProfitDisplay       = document.getElementById('job-profit-display');
const generalForm            = document.getElementById('finance-general-form');
const dailyTransactionsBody  = document.getElementById('daily-transactions-body');
const summaryIncome          = document.getElementById('summary-income');
const summaryExpense         = document.getElementById('summary-expense');
const summaryProfit          = document.getElementById('summary-profit');
const endDayBtn              = document.getElementById('end-day-btn');
const reportViewSection      = document.getElementById('report-view-section');
const pastReportsList        = document.getElementById('past-reports-list');
const viewReportsBtn         = document.getElementById('view-reports-btn');

// Supplier UI Elements
const addSupplierForm        = document.getElementById('add-supplier-form');
const suppliersTableBody     = document.getElementById('suppliers-table-body');
const whatsappSupplierSelect = document.getElementById('whatsapp-supplier-select');
const suppliesListTextarea   = document.getElementById('supplies-list');
const orderWhatsappBtn       = document.getElementById('order-whatsapp-btn');

// Inventory UI Elements
const addPartForm            = document.getElementById('add-part-form');
const partsInventoryBody     = document.getElementById('parts-inventory-body');
const sellPartForm           = document.getElementById('sell-part-form');
const partSaleSelect         = document.getElementById('part-sale-select');
const partSaleQuantityInput  = document.getElementById('part-sale-quantity');
const partSaleProfitDisplay  = document.getElementById('part-sale-profit-display');
const commitPartSaleBtn      = document.getElementById('commit-part-sale-btn');

// Invoice/Quote UI Elements
const invoiceCreationForm = document.getElementById('invoice-creation-form');
const quoteCreationForm   = document.getElementById('quote-creation-form');
const invoicesTableBody   = document.getElementById('invoices-table-body');
const quotesTableBody     = document.getElementById('quotes-table-body');

// Payroll UI Elements
const addEmployeeForm        = document.getElementById('add-employee-form');
const employeesListContainer = document.getElementById('employees-list-container');
const addCasualForm          = document.getElementById('add-casual-form');
const logCasualEarningForm   = document.getElementById('log-casual-earning-form');
const casualWorkersListContainer = document.getElementById('casual-workers-list-container');
const casualEarningsTableBody    = document.getElementById('casual-earnings-table-body');
const payhistoryTableBody        = document.getElementById('payhistory-table-body');

let allEmployees      = [];
let allCasualWorkers  = [];
let allCasualEarnings = [];
let allPayrollRuns    = [];
let _currentEmployeeId = null; // employee open in the payroll modal

let currentDailyTransactions = [];
let plChartInstance = null;
let allSuppliers = [];
let allPartsInventory = [];

// =================================================================
// 2. PIN-BASED AUTHENTICATION LOGIC
// =================================================================

let _mgmtPinBuffer = '';
const MGMT_PIN_MAX = 6;

function mgmtPinKey(val) {
    document.getElementById('mgmt-pin-message').textContent = '';
    if (val === 'back') {
        _mgmtPinBuffer = _mgmtPinBuffer.slice(0, -1);
    } else if (_mgmtPinBuffer.length < MGMT_PIN_MAX) {
        _mgmtPinBuffer += val;
    }
    updateMgmtPinDots();
    if (_mgmtPinBuffer.length === MGMT_PIN_MAX) enterPinAndLogin();
}
window.mgmtPinKey = mgmtPinKey;

function updateMgmtPinDots() {
    const dots = document.querySelectorAll('.mgmt-pin-dot');
    dots.forEach((d, i) => {
        d.classList.toggle('bg-indigo-600',    i < _mgmtPinBuffer.length);
        d.classList.toggle('border-indigo-600', i < _mgmtPinBuffer.length);
        d.classList.toggle('bg-white',         i >= _mgmtPinBuffer.length);
        d.classList.toggle('border-gray-300',  i >= _mgmtPinBuffer.length);
    });
}

async function enterPinAndLogin() {
    const codeInput = document.getElementById('mgmt-garage-code');
    const roleInput = document.getElementById('mgmt-role-select');
    const msg       = document.getElementById('mgmt-pin-message');

    const garageCode = (codeInput?.value || sessionStorage.getItem('garageCode') || '').trim().toUpperCase();
    const role       = roleInput?.value || 'manager';

    if (!garageCode) { msg.textContent = 'Enter your garage code first.'; return; }
    if (_mgmtPinBuffer.length < 4) { msg.textContent = 'PIN must be at least 4 digits.'; return; }

    msg.textContent = '⏳ Verifying…';
    document.querySelectorAll('.mgmt-pin-key').forEach(b => b.disabled = true);

    const result = await verifyPin(garageCode, role, _mgmtPinBuffer, db, doc, getDoc);

    document.querySelectorAll('.mgmt-pin-key').forEach(b => b.disabled = false);
    _mgmtPinBuffer = '';
    updateMgmtPinDots();

    if (!result.ok) {
        msg.textContent = result.error || 'Incorrect PIN.';
        return;
    }

    // --- NEW: Store garage data globally for permissions ---
    window._garageData = result.garageData;

    if (result.firstSetup) {
        msg.textContent = '';
        alert('Welcome! Default manager PIN is 0000. Please set your PINs in Settings immediately.');
    }

    setSession(garageCode, role);
    if (result.garageData) showTrialBanner(result.garageData);
    grantManagementAccess(role);
}
window.enterPinAndLogin = enterPinAndLogin;

const DEFAULT_PERMISSIONS = {
    admin: {
        allowedTabs: ['tab-finance', 'tab-inventory', 'tab-suppliers', 'tab-invoices', 'tab-quotes', 'tab-branding']
    },
    mechanic: {
        allowedTabs: ['tab-inventory', 'tab-invoices', 'tab-quotes']
    }
};

async function loadRolePermissions() {
    const permsSection = document.getElementById('role-permissions-section');
    // Only managers can see this section
    if (!can('managePins')) {
        if (permsSection) permsSection.style.display = 'none';
        return;
    }
    if (permsSection) permsSection.style.display = '';

    const garageCode = sessionStorage.getItem('garageCode');
    if (!garageCode) return;

    try {
        const snap = await getDoc(doc(db, 'garages', garageCode));
        if (!snap.exists()) return;
        const data = snap.data();
        const perms = data.rolePermissions || DEFAULT_PERMISSIONS;

        const tbody = document.getElementById('role-permissions-tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        const roles = ['admin', 'mechanic'];
        const tabIds = ['tab-finance', 'tab-payroll', 'tab-inventory', 'tab-suppliers', 'tab-invoices', 'tab-quotes', 'tab-branding'];
        const roleLabels = { admin: '👤 Admin', mechanic: '🔧 Mechanic' };

        roles.forEach(role => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td class="px-4 py-2 font-medium">${roleLabels[role]}</td>`;
            const allowed = perms[role]?.allowedTabs || [];
            tabIds.forEach(tabId => {
                const checked = allowed.includes(tabId) ? 'checked' : '';
                tr.innerHTML += `
                    <td class="px-4 py-2 text-center">
                        <input type="checkbox" class="role-perm-checkbox" data-role="${role}" data-tab="${tabId}" ${checked}>
                    </td>
                `;
            });
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Error loading permissions:', err);
    }
}

async function saveRolePermissions() {
    const msg = document.getElementById('role-perm-save-msg');
    if (!msg) return;

    msg.textContent = 'Saving…';
    msg.className = 'text-blue-500 text-sm font-semibold';

    const garageCode = sessionStorage.getItem('garageCode');
    if (!garageCode) {
        msg.textContent = 'No garage session.';
        msg.className = 'text-red-500 text-sm font-semibold';
        return;
    }

    const checkboxes = document.querySelectorAll('.role-perm-checkbox');
    const perms = {
        admin: { allowedTabs: [] },
        mechanic: { allowedTabs: [] }
    };

    checkboxes.forEach(cb => {
        const role = cb.dataset.role;
        const tab = cb.dataset.tab;
        if (cb.checked) {
            perms[role].allowedTabs.push(tab);
        }
    });

    try {
        await updateDoc(doc(db, 'garages', garageCode), { rolePermissions: perms });
        msg.textContent = '✅ Permissions saved successfully!';
        msg.className = 'text-green-600 text-sm font-semibold';

        // Re‑apply current user's permissions (in case the manager changed their own)
        const { role } = getSession();
        const allowed = applyRolePermissions(role);
        renderTabs(allowed);
    } catch (err) {
        msg.textContent = `❌ Error: ${err.message}`;
        msg.className = 'text-red-600 text-sm font-semibold';
    }
}

const ALL_TABS = ['tab-finance', 'tab-payroll', 'tab-inventory', 'tab-requests', 'tab-suppliers', 'tab-invoices', 'tab-quotes', 'tab-deletions', 'tab-accrual', 'tab-branding'];

function applyRolePermissions(role) {
    // Manager always gets full access — never restrict
    if (role === 'manager') return ALL_TABS;

    const garageData = window._garageData;
    const perms = garageData?.rolePermissions;

    // Use saved custom permissions if they exist for this role
    if (perms && perms[role] && Array.isArray(perms[role].allowedTabs) && perms[role].allowedTabs.length > 0) {
        return perms[role].allowedTabs;
    }

    // Fall back to hard-coded defaults
    return DEFAULT_PERMISSIONS[role]?.allowedTabs || [];
}

function renderTabs(allowedTabs) {
    const allTabButtons = document.querySelectorAll('.tab-button');
    let firstVisible = null;

    allTabButtons.forEach(btn => {
        const id = btn.id;
        if (allowedTabs.includes(id)) {
            btn.style.display = '';
            if (!firstVisible) firstVisible = btn;
        } else {
            btn.style.display = 'none';
            // Also hide the associated content panel
            const contentId = id.replace('tab-', 'content-');
            const content = document.getElementById(contentId);
            if (content) content.classList.add('hidden');
        }
    });

    // Activate the first visible tab, or fallback to the first tab overall
    if (firstVisible) {
        firstVisible.click();
    } else {
        // If nothing is visible (should not happen), show the first tab
        const fallback = document.querySelector('.tab-button');
        if (fallback) fallback.click();
    }
}



function grantManagementAccess(role) {
    authSection.style.display = 'none';
    dashboardSection.classList.remove('hidden');
    logoutBtn.style.display = 'block';

    // Role badge
    const badge = document.getElementById('mgmt-role-badge');
    if (badge) {
        const cfg = {
            manager: { label: '💼 Manager', cls: 'bg-green-100 text-green-800' },
            admin:   { label: '👤 Admin',   cls: 'bg-purple-100 text-purple-800' },
        };
        const c = cfg[role] || cfg.admin;
        badge.textContent = c.label;
        badge.className = `text-xs font-bold px-3 py-1 rounded-full ${c.cls}`;
    }

    // --- NEW: Apply dynamic tab permissions for this role ---
    // Ensure garage data is available (should have been set during login)
    const allowedTabs = applyRolePermissions(role);
    renderTabs(allowedTabs);

    // Role permissions section lives inside the Settings (branding) tab.
    // Show it only for managers; it becomes visible naturally when that tab is opened.
    const permSection = document.getElementById('role-permissions-section');
    if (permSection) {
        if (can('managePins')) {
            permSection.style.display = '';   // visible (but only accessible via the Settings tab)
            loadRolePermissions();
        } else {
            permSection.style.display = 'none';
        }
    }

    // PIN management tab/section visible to manager only
    const pinSection = document.getElementById('pin-management-section');
    if (pinSection) pinSection.style.display = can('managePins') ? '' : 'none';

    // Financial reports (net profit chart & history) are manager-only
    if (viewReportsBtn) viewReportsBtn.style.display = can('viewFinancials') ? '' : 'none';

    // Invoices table "Profit" column is manager-only
    const invoicesProfitHeader = document.getElementById('invoices-profit-col-header');
    if (invoicesProfitHeader) invoicesProfitHeader.classList.toggle('hidden', !can('viewFinancials'));

    // Initial state of the live job-profit calculator respects the permission
    if (jobProfitDisplay) {
        jobProfitDisplay.textContent = can('viewFinancials') ? 'Profit: KSh0.00' : '🔒 Profit hidden';
        jobProfitDisplay.className = 'text-center font-bold text-lg text-gray-500';
    }

    // The Payroll tab visibility is now controlled by the permission system
    // so we remove the old hardcoded line:
    // const payrollTabBtn = document.getElementById('tab-payroll');
    // if (payrollTabBtn) payrollTabBtn.style.display = can('viewFinancials') ? '' : 'none';

    // Start listeners – these will still run for all roles,
    // but the UI will only show the allowed tabs.
    // You could optionally conditionally start listeners based on allowedTabs,
    // but it's safe to keep them all running.
    listenForDailyTransactions();
    listenForSuppliers();
    listenForPartsInventory();
    listenForInventoryLedger();
    listenForPartsRequisitions();
    listenForPendingInventory();
    listenForInvoices();
    listenForQuotes();
    listenForActiveJobCars();
    listenForInvoiceNotifications();
    listenForDeletionRequests();
    applyDefaultVatToInvoiceForm();
    if (can('viewFinancials')) {
        listenForEmployees();
        listenForCasualWorkers();
        listenForCasualEarnings();
        listenForPayrollRuns();
    }

    // Hourly subscription re-check
    const garageCode = sessionStorage.getItem('garageCode');
    setInterval(async () => {
        const today = new Date().toDateString();
        if (sessionStorage.getItem('lastChecked') === today) return;
        const snap = await getDoc(doc(db, 'garages', garageCode)).catch(() => null);
        if (!snap || !snap.exists()) return;
        const status = (snap.data().subscriptionStatus || '').toLowerCase();
        if (status === 'inactive') {
            alert('Subscription expired. Please renew.');
            clearSession();
            location.reload();
        }
        sessionStorage.setItem('lastChecked', new Date().toDateString());
    }, 60 * 60 * 1000);
}

// Boot: check for existing session or show login
async function bootManagement() {
    const { garageCode, role, authed } = getSession();
    if (authed && garageCode && (role === 'manager' || role === 'admin')) {
        // Re-fetch garage data so permissions work correctly on page refresh
        try {
            const snap = await getDoc(doc(db, 'garages', garageCode));
            if (snap.exists()) {
                window._garageData = snap.data();
            }
        } catch (e) {
            console.warn('Could not refresh garage data on boot:', e);
        }
        grantManagementAccess(role);
        return;
    }
    authSection.style.display = 'flex';
    dashboardSection.classList.add('hidden');
    logoutBtn.style.display = 'none';
    // Pre-fill garage code if available
    const codeInput = document.getElementById('mgmt-garage-code');
    if (codeInput && garageCode) codeInput.value = garageCode;
}
bootManagement();

logoutBtn.addEventListener('click', () => { clearSession(); location.reload(); });

document.getElementById('backToAppBtn')?.addEventListener('click', () => {
    window.location.href = 'index.html';
});

// =================================================================
// 3. TAB SWITCHING LOGIC
// =================================================================

tabNav.addEventListener('click', (event) => {
    if (event.target.classList.contains('tab-button')) {
        const targetId = event.target.id.replace('tab-', 'content-');
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active-tab'));
        tabContents.forEach(content => content.classList.add('hidden'));
        event.target.classList.add('active-tab');
        document.getElementById(targetId).classList.remove('hidden');
        if (targetId === 'content-finance') {
            document.getElementById('report-view-section').classList.add('hidden');
        }
        if (targetId === 'content-accrual') {
            renderCarProfitability();
            renderAccrualMonthlyTable();
        }
    }
});

// =================================================================
// 4. FINANCE & REPORTS LOGIC
// =================================================================

[jobIncomeInput, jobExpenseInput].forEach(input => {
    input.addEventListener('input', () => {
        const income  = parseFloat(jobIncomeInput.value) || 0;
        const expense = parseFloat(jobExpenseInput.value) || 0;
        const profit  = income - expense;
        if (can('viewFinancials')) {
            jobProfitDisplay.textContent = `Profit: KSh${profit.toFixed(2)}`;
            jobProfitDisplay.className = profit >= 0
                ? 'font-bold text-lg text-green-600'
                : 'font-bold text-lg text-red-600';
        } else {
            jobProfitDisplay.textContent = '🔒 Profit hidden';
            jobProfitDisplay.className = 'font-bold text-lg text-gray-400';
        }
    });
});

jobForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const income  = parseFloat(jobIncomeInput.value);
    const expense = parseFloat(jobExpenseInput.value);
    const profit  = income - expense;

    const transaction = {
        type:        'JOB',
        subtype:     document.getElementById('job-type').value,
        plate:       document.getElementById('job-plate').value || 'N/A',
        description: document.getElementById('job-type').value + (document.getElementById('job-plate').value ? ` for plate ${document.getElementById('job-plate').value}` : ''),
        income,
        expense,
        profit,
        timestamp: serverTimestamp(),
        isJob: true,
        date: getUTCDateString()
    };

    try {
        await addDoc(getDailyTransactionsRef(), transaction);
        jobForm.reset();
        jobProfitDisplay.textContent = can('viewFinancials') ? 'Profit: KSh0.00' : '🔒 Profit hidden';
        jobProfitDisplay.className = 'font-bold text-lg text-gray-500';
    } catch (error) {
        alert('Failed to record job transaction.');
        console.error('Job Transaction Error: ', error);
    }
});

generalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount   = parseFloat(document.getElementById('general-amount').value);
    const type     = document.getElementById('general-type').value;
    const isIncome = type === 'Other Income';

    const transaction = {
        type:        isIncome ? 'INCOME' : 'EXPENSE',
        subtype:     type,
        description: type,
        plate:       'N/A',
        income:      isIncome ? amount : 0,
        expense:     isIncome ? 0 : amount,
        profit:      isIncome ? amount : -amount,
        timestamp:   serverTimestamp(),
        isJob:       false,
        date:        getUTCDateString()
    };

    try {
        await addDoc(getDailyTransactionsRef(), transaction);
        generalForm.reset();
    } catch (error) {
        alert('Failed to record general transaction.');
        console.error('General Transaction Error: ', error);
    }
});

function safeToFixed(value, decimals = 2) {
    let num = parseFloat(value);
    if (isNaN(num)) num = 0;
    return num.toFixed(decimals);
}

let unsubscribeDailyTransactions = null;
let dailyRolloverTimer = null;

function listenForDailyTransactions() {
    // Tear down any previous listener (used when the day rolls over)
    if (unsubscribeDailyTransactions) {
        unsubscribeDailyTransactions();
        unsubscribeDailyTransactions = null;
    }
    if (dailyRolloverTimer) {
        clearTimeout(dailyRolloverTimer);
        dailyRolloverTimer = null;
    }

    const today = getUTCDateString();
    // NOTE: we deliberately do NOT add where('archived','!=',true) here.
    // Firestore's "!=" operator excludes any document that doesn't have the
    // field at all — and every existing/new transaction doc has no
    // `archived` field unless End Day has touched it. That would have
    // silently hidden ALL transactions, old and new, which is exactly the
    // kind of "transactions disappear" bug we're trying to fix. Instead we
    // filter archived items out client-side just below.
    const q = query(getDailyTransactionsRef(), where('date', '==', today), orderBy('timestamp', 'asc'));

    // Schedule an automatic re-subscribe right after local midnight, so a
    // console left open overnight switches over to the new day's
    // transactions on its own instead of silently freezing on yesterday.
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
    dailyRolloverTimer = setTimeout(() => {
        listenForDailyTransactions();
    }, nextMidnight.getTime() - now.getTime());

    unsubscribeDailyTransactions = onSnapshot(q, snapshot => {
        currentDailyTransactions = [];
        let totalIncome = 0, totalExpense = 0;
        dailyTransactionsBody.innerHTML = '';

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.archived === true) return; // skip transactions already closed out by End Day

            const income  = parseFloat(data.income);
            const expense = parseFloat(data.expense);
            let profit    = parseFloat(data.profit);
            if (isNaN(profit)) profit = (isNaN(income) ? 0 : income) - (isNaN(expense) ? 0 : expense);
            if (isNaN(profit)) profit = 0;

            const safeIncome  = isNaN(income)  ? 0 : income;
            const safeExpense = isNaN(expense) ? 0 : expense;
            totalIncome  += safeIncome;
            totalExpense += safeExpense;

            const displayTime = data.timestamp && typeof data.timestamp.toDate === 'function'
                ? new Date(data.timestamp.toDate()).toLocaleTimeString()
                : 'Pending...';

            currentDailyTransactions.push({
                id: docSnap.id, income: safeIncome, expense: safeExpense,
                profit, description: data.description || '',
                subtype: data.subtype || 'Other', plate: data.plate || 'N/A',
                timestamp: data.timestamp
            });

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50';
            const profitClass = profit >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium';
            const profitCell = can('viewFinancials')
                ? `<td class="px-3 py-2 whitespace-nowrap text-sm ${profitClass}">KSh${safeToFixed(profit)}</td>`
                : `<td class="px-3 py-2 whitespace-nowrap text-sm text-gray-400">🔒 Hidden</td>`;
            tr.innerHTML = `
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500">${displayTime}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900">${escapeHtml(data.subtype || 'Other')}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500">${escapeHtml(data.plate || 'N/A')}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-green-600">KSh${safeToFixed(safeIncome)}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-red-600">KSh${safeToFixed(safeExpense)}</td>
                ${profitCell}
                <td class="px-3 py-2 whitespace-nowrap text-sm">
                    <button onclick="deleteTransaction('${docSnap.id}')" class="text-red-500 hover:text-red-700">Delete</button>
                </td>
            `;
            dailyTransactionsBody.appendChild(tr);
        });

        const netProfit = totalIncome - totalExpense;
        summaryIncome.textContent  = `KSh${safeToFixed(totalIncome)}`;
        summaryExpense.textContent = `KSh${safeToFixed(totalExpense)}`;
        if (can('viewFinancials')) {
            summaryProfit.textContent = `KSh${safeToFixed(netProfit)}`;
            summaryProfit.className   = netProfit >= 0 ? 'font-bold text-indigo-600' : 'font-bold text-red-600';
        } else {
            summaryProfit.textContent = '🔒 Hidden';
            summaryProfit.className   = 'font-bold text-gray-400';
        }
        endDayBtn.disabled         = currentDailyTransactions.length === 0;
    }, error => console.error("Error listening to daily transactions: ", error));
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m] || m));
}

async function deleteTransaction(id) {
    if (confirm('Are you sure you want to delete this transaction?')) {
        try {
            await deleteDoc(garageDoc(db, doc, 'dailyTransactions', id));
        } catch (error) {
            alert('Failed to delete transaction.');
            console.error('Delete Transaction Error: ', error);
        }
    }
}
window.deleteTransaction = deleteTransaction;

// End Day — saves a full P&L report (with every line item) and then
// ARCHIVES today's transactions so they stop showing under "Today" and
// stop accumulating forever in the live collection.
//
// Archiving = setting archived:true + archivedDate on each transaction
// doc (NOT deleting them) so the underlying data is never lost — it just
// moves out of the live "today" query. This also means the Daily Report
// PDF can show real line items, and a History view can pull them back up
// for any past day.
endDayBtn.addEventListener('click', async () => {
    if (currentDailyTransactions.length === 0) return;
    if (!confirm('Close today and save the P&L report? This cannot be undone.')) return;

    endDayBtn.disabled = true;
    endDayBtn.textContent = 'Saving…';

    const today          = getUTCDateString();
    // Use a fixed doc ID = date so a second concurrent click hits the same doc and the
    // transaction detects it already exists — preventing duplicate reports
    const reportRef      = garageDoc(db, doc, 'financialReports', today);
    const { garageCode } = getSession();

    try {
        // Snapshot the transaction list and totals up front (used both for
        // the report content and the archive batch below).
        const transactionsSnapshot = currentDailyTransactions.map(t => ({
            id:          t.id,
            description: t.description || t.subtype || 'Transaction',
            subtype:     t.subtype || 'Other',
            plate:       t.plate || 'N/A',
            income:      t.income  || 0,
            expense:     t.expense || 0,
            profit:      t.profit  || 0,
            // Firestore Timestamp objects can't always survive transaction.set
            // cleanly inside arrays on every SDK version, so store a plain
            // ISO string snapshot of the time alongside the raw timestamp.
            timestamp:   t.timestamp || null,
            timeLabel:   (t.timestamp && typeof t.timestamp.toDate === 'function')
                            ? t.timestamp.toDate().toISOString()
                            : null
        }));
        let totalIncome = 0, totalExpense = 0;
        transactionsSnapshot.forEach(t => { totalIncome += t.income; totalExpense += t.expense; });
        const netProfit = totalIncome - totalExpense;
        const idsToArchive = currentDailyTransactions.map(t => t.id);

        await runTransaction(db, async (transaction) => {
            const existing = await transaction.get(reportRef);
            if (existing.exists()) {
                throw new Error('A report for today already exists. Reload to see it.');
            }

            transaction.set(reportRef, {
                date:         today,
                garageCode,
                totalIncome,
                totalExpense,
                netProfit,
                transactionCount: transactionsSnapshot.length,
                transactions: transactionsSnapshot,
                savedAt:      serverTimestamp(),
                savedBy:      getSession().role,
            });
        });

        // Archive the day's transactions in batches (Firestore batches cap
        // at 500 writes) so they drop out of "Today" but stay in the
        // database for history/audit purposes.
        const BATCH_LIMIT = 450;
        for (let i = 0; i < idsToArchive.length; i += BATCH_LIMIT) {
            const chunk = idsToArchive.slice(i, i + BATCH_LIMIT);
            const batch = writeBatch(db);
            chunk.forEach(id => {
                batch.update(garageDoc(db, doc, 'dailyTransactions', id), {
                    archived:     true,
                    archivedDate: today
                });
            });
            await batch.commit();
        }

        alert(can('viewFinancials')
            ? `Day closed! Net profit: KSh${netProfit.toFixed(2)}`
            : 'Day closed! P&L report saved.');
    } catch (err) {
        alert(`Could not save report: ${err.message}`);
        console.error('End Day Error:', err);
    } finally {
        endDayBtn.disabled = currentDailyTransactions.length === 0;
        endDayBtn.textContent = 'End Day & Save P&L Report';
    }
});


// Cache of all loaded reports, keyed by date, so the day-detail viewer can
// look up line items without an extra Firestore round-trip.
let cachedReportsByDate = {};

viewReportsBtn.addEventListener('click', () => {
    if (!can('viewFinancials')) {
        alert('🔒 Financial reports are visible to managers only.');
        return;
    }
    reportViewSection.classList.remove('hidden');
    pastReportsList.innerHTML = '<p class="text-gray-500">Loading reports...</p>';
    document.getElementById('day-detail-section').classList.add('hidden');

    const q = query(getPastReportsRef(), orderBy('date', 'desc'));
    getDocs(q).then(snapshot => {
        if (snapshot.empty) {
            pastReportsList.innerHTML = '<p class="text-gray-500">No past reports saved yet. Use "End Day & Save P&L Report" to create your first one.</p>';
            document.getElementById('monthly-breakdown-body').innerHTML = '';
            renderConsolidatedSummary({}, 0);
            renderFinancialChart({});
            return;
        }

        const monthTotals = {};       // monthKey -> { income, expense, profit, days }
        let allTimeProfit  = 0;
        cachedReportsByDate = {};
        pastReportsList.innerHTML = '';

        // Newest first for the list, but we still need chronological data
        // for the month breakdown table, so collect first then render.
        const reports = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            reports.push({ id: docSnap.id, ...data });
            cachedReportsByDate[data.date] = { id: docSnap.id, ...data };
        });

        reports.forEach(data => {
            const monthKey = data.date.substring(0, 7);
            if (!monthTotals[monthKey]) monthTotals[monthKey] = { income: 0, expense: 0, profit: 0, days: 0 };
            monthTotals[monthKey].income  += data.totalIncome  || 0;
            monthTotals[monthKey].expense += data.totalExpense || 0;
            monthTotals[monthKey].profit  += data.netProfit    || 0;
            monthTotals[monthKey].days    += 1;
            allTimeProfit += data.netProfit || 0;

            const listItem = document.createElement('div');
            listItem.className = 'flex justify-between items-center p-2 bg-gray-50 rounded-lg shadow-sm';
            listItem.innerHTML = `
                <span class="font-medium cursor-pointer hover:text-indigo-700 hover:underline" onclick="showDayDetail('${data.date}')">${data.date}</span>
                <span class="${data.netProfit >= 0 ? 'text-green-600' : 'text-red-600'} font-bold">KSh${(data.netProfit ?? 0).toFixed(2)}</span>
                <button onclick="generateDailyReportPDF('${data.id}')" class="text-blue-500 hover:text-blue-700 text-sm">Print/View</button>
            `;
            pastReportsList.appendChild(listItem);
        });

        renderMonthlyBreakdownTable(monthTotals);
        renderConsolidatedSummary(monthTotals, allTimeProfit);
        renderFinancialChart(monthTotals);
    }).catch(error => {
        console.error("Error fetching reports: ", error);
        pastReportsList.innerHTML = '<p class="text-red-500">Error loading reports.</p>';
    });
});

function renderMonthlyBreakdownTable(monthTotals) {
    const tbody = document.getElementById('monthly-breakdown-body');
    const sortedMonths = Object.keys(monthTotals).sort().reverse();
    if (sortedMonths.length === 0) { tbody.innerHTML = ''; return; }

    tbody.innerHTML = sortedMonths.map(month => {
        const m = monthTotals[month];
        const profitClass = m.profit >= 0 ? 'text-green-600' : 'text-red-600';
        return `
            <tr class="hover:bg-gray-50">
                <td class="px-3 py-2 text-sm font-medium text-gray-700">${month}</td>
                <td class="px-3 py-2 text-sm text-green-600">KSh${m.income.toFixed(2)}</td>
                <td class="px-3 py-2 text-sm text-red-600">KSh${m.expense.toFixed(2)}</td>
                <td class="px-3 py-2 text-sm font-semibold ${profitClass}">KSh${m.profit.toFixed(2)}</td>
                <td class="px-3 py-2 text-sm text-gray-500">${m.days}</td>
            </tr>`;
    }).join('');
}

function renderConsolidatedSummary(monthTotals, allTimeProfit) {
    const thisMonthKey = getUTCDateString().substring(0, 7);
    const thisMonth = monthTotals[thisMonthKey] || { income: 0, expense: 0, profit: 0 };

    document.getElementById('cons-month-income').textContent  = `KSh${thisMonth.income.toFixed(2)}`;
    document.getElementById('cons-month-expense').textContent = `KSh${thisMonth.expense.toFixed(2)}`;

    const monthProfitEl = document.getElementById('cons-month-profit');
    monthProfitEl.textContent = `KSh${thisMonth.profit.toFixed(2)}`;
    monthProfitEl.className = `text-lg font-bold ${thisMonth.profit >= 0 ? 'text-indigo-600' : 'text-red-600'}`;

    const allTimeEl = document.getElementById('cons-alltime-profit');
    allTimeEl.textContent = `KSh${allTimeProfit.toFixed(2)}`;
    allTimeEl.className = `text-lg font-bold ${allTimeProfit >= 0 ? 'text-indigo-700' : 'text-red-700'}`;
}

function showDayDetail(date) {
    const report = cachedReportsByDate[date];
    const section = document.getElementById('day-detail-section');
    const body    = document.getElementById('day-detail-body');
    document.getElementById('day-detail-date').textContent = date;
    section.classList.remove('hidden');

    const items = (report && report.transactions) || [];
    if (items.length === 0) {
        body.innerHTML = `<tr><td colspan="6" class="px-3 py-3 text-sm text-gray-400 text-center">No itemized transactions saved for this day (older report, or day had no detail recorded).</td></tr>`;
        return;
    }

    body.innerHTML = items.map(t => {
        const timeLabel = (t.timestamp && typeof t.timestamp.toDate === 'function')
            ? t.timestamp.toDate().toLocaleTimeString()
            : (t.timeLabel ? new Date(t.timeLabel).toLocaleTimeString() : '—');
        const profitClass = (t.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600';
        return `
            <tr class="hover:bg-gray-50">
                <td class="px-3 py-2 text-sm text-gray-500">${timeLabel}</td>
                <td class="px-3 py-2 text-sm text-gray-900">${escapeHtml(t.description || t.subtype || '')}</td>
                <td class="px-3 py-2 text-sm text-gray-500">${escapeHtml(t.plate || 'N/A')}</td>
                <td class="px-3 py-2 text-sm text-green-600">KSh${(t.income || 0).toFixed(2)}</td>
                <td class="px-3 py-2 text-sm text-red-600">KSh${(t.expense || 0).toFixed(2)}</td>
                <td class="px-3 py-2 text-sm font-medium ${profitClass}">KSh${(t.profit || 0).toFixed(2)}</td>
            </tr>`;
    }).join('');

    section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
window.showDayDetail = showDayDetail;

document.getElementById('day-detail-close-btn')?.addEventListener('click', () => {
    document.getElementById('day-detail-section').classList.add('hidden');
});

function renderFinancialChart(monthTotalsRaw) {
    if (plChartInstance) plChartInstance.destroy();

    // Accept either the old shape (plain number per month) or the new
    // shape ({income, expense, profit, days}) for backward compatibility.
    const sortedMonths = Object.keys(monthTotalsRaw).sort();
    const profits = sortedMonths.map(month => {
        const v = monthTotalsRaw[month];
        return typeof v === 'number' ? v : v.profit;
    });

    const ctx = document.getElementById('pl-chart').getContext('2d');
    plChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedMonths,
            datasets: [{
                label: 'Monthly Net Profit (KSh)',
                data: profits,
                backgroundColor: profits.map(p => p >= 0 ? 'rgba(52, 211, 153, 0.7)' : 'rgba(239, 68, 68, 0.7)'),
                borderColor:     profits.map(p => p >= 0 ? 'rgba(52, 211, 153, 1)'   : 'rgba(239, 68, 68, 1)'),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true, title: { display: true, text: 'Profit/Loss (KSh)' } } }
        }
    });
}

async function generateDailyReportPDF(reportId) {
    try {
        const docSnap = await getDoc(garageDoc(db, doc, 'financialReports', reportId));
        if (!docSnap.exists()) { alert("Report not found."); return; }
        const report  = docSnap.data();
        const branding = await getBranding();

        const pdfDoc = new window.jspdf.jsPDF();
        let y = drawPdfHeader(pdfDoc, branding, "Daily P&L Report");

        pdfDoc.setFontSize(10);
        pdfDoc.setTextColor(60, 60, 60);
        pdfDoc.text(`Date: ${report.date}`, 14, y);
        pdfDoc.text(`Generated: ${new Date().toLocaleString()}`, 14, y + 5);
        y += 14;

        pdfDoc.autoTable({
            startY: y,
            head: [['Metric', 'Amount (KSh)']],
            body: [
                ['Total Income',  (report.totalIncome  ?? 0).toFixed(2)],
                ['Total Expense', (report.totalExpense ?? 0).toFixed(2)],
                ['NET PROFIT',    (report.netProfit    ?? 0).toFixed(2)],
            ],
            theme: 'grid', styles: { fontSize: 10 },
            headStyles: { fillColor: hexToRgbArr(branding.primaryColor) }
        });

        pdfDoc.setFontSize(14);
        pdfDoc.text("Detailed Transactions", 14, pdfDoc.autoTable.previous.finalY + 10);

        const transactionBody = (report.transactions || []).map(t => [
            (t.timestamp && typeof t.timestamp.toDate === 'function')
                ? t.timestamp.toDate().toLocaleTimeString()
                : (t.timeLabel ? new Date(t.timeLabel).toLocaleTimeString() : 'N/A'),
            t.description,
            (t.income  ?? 0).toFixed(2),
            (t.expense ?? 0).toFixed(2),
            (t.profit  ?? 0).toFixed(2)
        ]);

        pdfDoc.autoTable({
            startY: pdfDoc.autoTable.previous.finalY + 15,
            head: [['Time', 'Description', 'Income (KSh)', 'Expense (KSh)', 'Profit (KSh)']],
            body: transactionBody.length ? transactionBody : [['—', 'No itemized transactions saved for this report', '-', '-', '-']],
            theme: 'striped', styles: { fontSize: 8 },
            headStyles: { fillColor: hexToRgbArr(branding.primaryColor) }
        });

        drawPdfFooter(pdfDoc, branding);
        pdfDoc.save(`Report_${report.date}.pdf`);
    } catch (error) {
        console.error("PDF Generation Error: ", error);
        alert("Failed to generate PDF report.");
    }
}
window.generateDailyReportPDF = generateDailyReportPDF;

// =================================================================
// 5. PARTS INVENTORY LOGIC
// =================================================================

addPartForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const part = {
        name:          document.getElementById('part-name').value,
        sku:           document.getElementById('part-sku').value || '',
        quantity:      parseInt(document.getElementById('part-quantity').value),
        sellingPrice:  parseFloat(document.getElementById('part-selling-price').value),
        status:        'pending',
        loggedBy:      `${getSession().role}@${getSession().garageCode}`,
        createdAt:     serverTimestamp()
    };
    try {
        await addDoc(getPendingInventoryRef(), part);
        addPartForm.reset();
        alert('Part submitted! It will appear under 🔔 Pending Requests until the Manager sets the buying price and approves it.');
    } catch (error) {
        alert('Failed to submit part.');
        console.error('Part Submit Error: ', error);
    }
});

function attachPartSaleListeners() {
    [partSaleSelect, partSaleQuantityInput].forEach(input => {
        input.removeEventListener('input', calculatePartSaleProfit);
        input.addEventListener('input', calculatePartSaleProfit);
    });
    calculatePartSaleProfit();
}

function calculatePartSaleProfit() {
    const partOption   = partSaleSelect.options[partSaleSelect.selectedIndex];
    const quantitySold = parseInt(partSaleQuantityInput.value) || 0;

    commitPartSaleBtn.disabled = true;
    partSaleProfitDisplay.textContent = 'KSh0.00';
    partSaleProfitDisplay.className   = 'font-bold text-xl text-gray-500';

    if (!partOption || !partOption.value || quantitySold <= 0) return;

    const stock = parseInt(partOption.dataset.stock);
    if (quantitySold > stock) {
        partSaleProfitDisplay.textContent = 'Error: Qty exceeds stock!';
        partSaleProfitDisplay.className   = 'font-bold text-lg text-red-600';
        return;
    }

    const supplierPrice = parseFloat(partOption.dataset.supplierPrice);
    const sellingPrice  = parseFloat(partOption.dataset.sellingPrice);
    const totalProfit   = (sellingPrice - supplierPrice) * quantitySold;

    if (can('viewFinancials')) {
        partSaleProfitDisplay.textContent = `KSh${totalProfit.toFixed(2)}`;
        partSaleProfitDisplay.className   = totalProfit >= 0 ? 'font-bold text-xl text-green-600' : 'font-bold text-xl text-red-600';
    } else {
        partSaleProfitDisplay.textContent = '🔒 Hidden';
        partSaleProfitDisplay.className   = 'font-bold text-xl text-gray-400';
    }
    commitPartSaleBtn.disabled = false;
}

sellPartForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const partId       = partSaleSelect.value;
    const partOption   = partSaleSelect.options[partSaleSelect.selectedIndex];
    const quantitySold = parseInt(partSaleQuantityInput.value);
    const carPlate     = (document.getElementById('part-sale-plate').value || '').trim().toUpperCase() || 'N/A';
    const issuedTo     = (document.getElementById('part-sale-issued-to').value || '').trim();
    const purpose      = (document.getElementById('part-sale-purpose').value || '').trim();

    if (!partId || quantitySold <= 0) return alert("Please select a part and specify quantity.");
    if (!issuedTo) return alert("Please enter the name of the person receiving the part.");

    const stock = parseInt(partOption.dataset.stock);
    if (quantitySold > stock) return alert(`Cannot sell ${quantitySold}. Only ${stock} in stock.`);

    const supplierPrice = parseFloat(partOption.dataset.supplierPrice);
    const sellingPrice  = parseFloat(partOption.dataset.sellingPrice);
    const partName      = partOption.textContent.substring(0, partOption.textContent.indexOf(' (Stock'));
    const totalIncome   = sellingPrice  * quantitySold;
    const totalExpense  = supplierPrice * quantitySold;
    const totalProfit   = totalIncome - totalExpense;

    const confirmMsg = can('viewFinancials')
        ? `Confirm:\n  ${quantitySold} x ${partName}\n  Issued to: ${issuedTo}\n  Vehicle: ${carPlate}\n  Revenue: KSh${totalIncome.toFixed(2)}   Profit: KSh${totalProfit.toFixed(2)}`
        : `Confirm:\n  ${quantitySold} x ${partName}\n  Issued to: ${issuedTo}\n  Vehicle: ${carPlate}\n  Revenue: KSh${totalIncome.toFixed(2)}`;
    if (!confirm(confirmMsg)) return;

    commitPartSaleBtn.disabled = true;
    try {
        const partRef   = garageDoc(db, doc, 'partsInventory', partId);
        const transRef  = doc(getDailyTransactionsRef());
        const ledgerRef = doc(getInventoryLedgerRef());

        await runTransaction(db, async (transaction) => {
            const partSnap = await transaction.get(partRef);
            if (!partSnap.exists()) throw new Error('Part no longer exists.');

            const liveStock = partSnap.data().quantity ?? 0;
            if (quantitySold > liveStock) {
                throw new Error(`Only ${liveStock} unit(s) left in stock. Another session may have just sold some.`);
            }

            transaction.update(partRef, { quantity: liveStock - quantitySold });

            transaction.set(transRef, {
                type: 'PART SALE', subtype: partName, plate: carPlate,
                description: `${quantitySold} x ${partName} → ${issuedTo} (Plate: ${carPlate})`,
                income: totalIncome, expense: totalExpense, profit: totalProfit,
                timestamp: serverTimestamp(), isJob: true, date: getUTCDateString()
            });

            // ── Ledger entry — full traceability record ──────────────────────
            transaction.set(ledgerRef, {
                partId,
                partName,
                quantitySold,
                issuedTo,
                vehiclePlate:  carPlate,
                purpose:       purpose || '',
                sellingPrice,
                supplierPrice,
                totalIncome,
                totalExpense,
                totalProfit,
                issuedBy:  sessionStorage.getItem('userRole') || 'unknown',
                timestamp: serverTimestamp(),
                date:      getUTCDateString(),
            });
        });

        alert(can('viewFinancials')
            ? `Sale committed! ${quantitySold} x ${partName} issued to ${issuedTo}.\nProfit: KSh${totalProfit.toFixed(2)} recorded in Finance.`
            : `Sale committed! ${quantitySold} x ${partName} issued to ${issuedTo}.`);
        sellPartForm.reset();
        partSaleProfitDisplay.textContent = can('viewFinancials') ? 'KSh0.00' : '🔒 Hidden';
    } catch (error) {
        alert(`Sale failed: ${error.message}`);
        console.error('Part Sale Error: ', error);
    } finally {
        commitPartSaleBtn.disabled = false;
    }
});

function listenForPartsInventory() {
    const q = query(getPartsInventoryRef(), orderBy('name', 'asc'));
    onSnapshot(q, snapshot => {
        allPartsInventory = [];
        partsInventoryBody.innerHTML = '';
        partSaleSelect.innerHTML = '<option value="">Select Part to Sell</option>';

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            allPartsInventory.push({ id: docSnap.id, ...data });

            const profitPerUnit = (data.sellingPrice ?? 0) - (data.supplierPrice ?? 0);
            const quantityClass = data.quantity < 5 ? 'text-red-600 font-bold' : 'text-gray-900';
            const costCell = can('viewFinancials')
                ? `KSh${(data.supplierPrice ?? 0).toFixed(2)}`
                : `<span class="text-gray-400">🔒 Hidden</span>`;

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50';
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${data.name} (${data.sku || 'N/A'})</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm ${quantityClass}">${data.quantity}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-red-600">${costCell}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-green-600">KSh${(data.sellingPrice ?? 0).toFixed(2)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onclick="deletePart('${docSnap.id}')" class="text-red-600 hover:text-red-900">Delete</button>
                </td>
            `;
            partsInventoryBody.appendChild(tr);

            if (data.quantity > 0) {
                const option = document.createElement('option');
                option.value = docSnap.id;
                option.textContent = can('viewFinancials')
                    ? `${data.name} (Stock: ${data.quantity}, Profit/Unit: KSh${profitPerUnit.toFixed(2)})`
                    : `${data.name} (Stock: ${data.quantity})`;
                option.dataset.supplierPrice = data.supplierPrice;
                option.dataset.sellingPrice  = data.sellingPrice;
                option.dataset.stock         = data.quantity;
                partSaleSelect.appendChild(option);
            }
        });

        attachPartSaleListeners();
        refreshInvoiceStockDropdowns();
    }, error => console.error("Error listening to parts inventory: ", error));
}

// Keep any "Part from my stock" invoice line dropdowns in sync with live inventory
function refreshInvoiceStockDropdowns() {
    document.querySelectorAll('#invoice-items-container .invoice-item-row[data-type="stock"] .invoice-item-stock-select').forEach(select => {
        const currentVal = select.value;
        select.innerHTML = buildStockPartOptionsHtml(currentVal);
    });
}

window.deletePart = (id) => {
    if (confirm("Delete this part from inventory? This cannot be undone.")) {
        deleteDoc(garageDoc(db, doc, 'partsInventory', id))
            .catch(e => { alert('Failed to delete part.'); console.error("Delete Part Error", e); });
    }
};

// =================================================================
// 5b. INVENTORY LEDGER — Audit Trail
// =================================================================

let _allLedgerEntries = [];

function listenForInventoryLedger() {
    const q = query(getInventoryLedgerRef(), orderBy('timestamp', 'desc'));
    onSnapshot(q, snapshot => {
        _allLedgerEntries = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderLedger(_allLedgerEntries);
    }, err => console.error('Ledger listener error:', err));
}

function renderLedger(entries) {
    const tbody    = document.getElementById('ledger-table-body');
    const emptyMsg = document.getElementById('ledger-empty-msg');
    if (!tbody) return;

    if (entries.length === 0) {
        tbody.innerHTML = '';
        if (emptyMsg) emptyMsg.classList.remove('hidden');
        return;
    }
    if (emptyMsg) emptyMsg.classList.add('hidden');

    tbody.innerHTML = entries.map(e => {
        const dateStr = e.timestamp?.toDate
            ? e.timestamp.toDate().toLocaleString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : (e.date || 'N/A');
        const plateHtml = (e.vehiclePlate && e.vehiclePlate !== 'N/A')
            ? `<span class="font-mono font-bold text-blue-700">${e.vehiclePlate}</span>`
            : `<span class="text-gray-400">—</span>`;
        const profitCls = (e.totalProfit ?? 0) >= 0 ? 'text-green-600' : 'text-red-600';
        return `
            <tr class="hover:bg-indigo-50 transition">
                <td class="px-4 py-3 whitespace-nowrap text-xs text-gray-500">${dateStr}</td>
                <td class="px-4 py-3 text-sm font-medium text-gray-900">${e.partName}</td>
                <td class="px-4 py-3 text-sm text-center font-bold text-gray-700">${e.quantitySold}</td>
                <td class="px-4 py-3 text-sm font-semibold text-indigo-700">${e.issuedTo || '—'}</td>
                <td class="px-4 py-3 text-sm">${plateHtml}</td>
                <td class="px-4 py-3 text-sm text-gray-500">${e.purpose || '—'}</td>
                <td class="px-4 py-3 text-sm font-semibold ${profitCls}">KSh${(e.totalIncome ?? 0).toFixed(2)}</td>
            </tr>`;
    }).join('');
}

window.filterLedger = function () {
    const q = (document.getElementById('ledger-search')?.value || '').toLowerCase();
    if (!q) { renderLedger(_allLedgerEntries); return; }
    renderLedger(_allLedgerEntries.filter(e =>
        (e.partName     || '').toLowerCase().includes(q) ||
        (e.issuedTo     || '').toLowerCase().includes(q) ||
        (e.vehiclePlate || '').toLowerCase().includes(q) ||
        (e.purpose      || '').toLowerCase().includes(q)
    ));
};

// =================================================================
// 5c. PENDING REQUESTS — Parts Requisitions + Pending Inventory Approvals
// =================================================================

let _allRequisitions    = [];
let _allPendingInventory = [];
let _reqFilter = 'pending'; // 'pending' | 'actioned' | 'rejected' | 'all'

// Approved/one-time-ordered requisitions are considered "actioned" and move out of the
// default pending view. Rejected ones are tracked separately (treated as the "revoked" bucket).
window.setReqFilter = function (filter) {
    _reqFilter = filter;
    ['pending', 'actioned', 'rejected', 'all'].forEach(f => {
        const btn = document.getElementById(`req-filter-${f}`);
        if (!btn) return;
        if (f === filter) {
            btn.className = 'req-filter-btn text-xs font-bold px-3 py-1.5 rounded-full bg-yellow-500 text-white';
            if (f !== 'pending') {
                const colorMap = { actioned: 'bg-green-600', rejected: 'bg-red-600', all: 'bg-indigo-600' };
                btn.className = `req-filter-btn text-xs font-bold px-3 py-1.5 rounded-full ${colorMap[f]} text-white`;
            }
        } else {
            btn.className = 'req-filter-btn text-xs font-bold px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200';
        }
    });
    renderRequisitions();
};

function updateRequestsBadge() {
    const badge = document.getElementById('requests-badge');
    if (!badge) return;
    const pendingReqs = _allRequisitions.filter(r => r.status === 'pending').length;
    const total = pendingReqs + _allPendingInventory.length;
    if (total > 0) {
        badge.textContent = String(total);
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function listenForPartsRequisitions() {
    const q = query(getPartsRequisitionsRef(), orderBy('createdAt', 'desc'));
    onSnapshot(q, snapshot => {
        _allRequisitions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderRequisitions();
        updateRequestsBadge();
    }, err => console.error('Requisitions listener error:', err));
}

const REQ_STATUS_BADGE = {
    'pending':        'bg-yellow-100 text-yellow-800',
    'approved':       'bg-green-100 text-green-800',
    'one-time-ordered': 'bg-purple-100 text-purple-800',
    'rejected':       'bg-red-100 text-red-800'
};

function renderRequisitions() {
    const tbody = document.getElementById('requisitions-table-body');
    const emptyMsg = document.getElementById('requisitions-empty-msg');
    if (!tbody) return;

    const searchTerm = (document.getElementById('req-search-plate')?.value || '').trim().toLowerCase();

    // Status bucket filter:
    //   pending   -> status === 'pending' (needs action)
    //   actioned  -> status === 'approved' || 'one-time-ordered' (fulfilled, moved out of the way)
    //   rejected  -> status === 'rejected' (the "revoked" bucket)
    //   all       -> everything
    let filtered = _allRequisitions;
    if (_reqFilter === 'pending') {
        filtered = filtered.filter(r => (r.status || 'pending') === 'pending');
    } else if (_reqFilter === 'actioned') {
        filtered = filtered.filter(r => r.status === 'approved' || r.status === 'one-time-ordered');
    } else if (_reqFilter === 'rejected') {
        filtered = filtered.filter(r => r.status === 'rejected');
    }
    // 'all' falls through with no filtering

    if (searchTerm) {
        filtered = filtered.filter(r => (r.plate || '').toLowerCase().includes(searchTerm));
    }

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        if (emptyMsg) {
            emptyMsg.textContent = searchTerm
                ? `No requests match plate "${document.getElementById('req-search-plate').value}".`
                : (_reqFilter === 'pending' ? 'No pending requests — all caught up.' : 'No requests in this view.');
            emptyMsg.classList.remove('hidden');
        }
        return;
    }
    if (emptyMsg) emptyMsg.classList.add('hidden');

    tbody.innerHTML = filtered.map(r => {
        const badgeCls = REQ_STATUS_BADGE[r.status] || 'bg-gray-100 text-gray-700';
        const statusLabel = (r.status || 'pending').replace(/-/g, ' ');
        let actions = `<span class="text-xs text-gray-400">No action needed</span>`;
        if (r.status === 'pending' && can('viewFinancials')) {
            actions = `
                <div class="flex flex-col gap-1">
                    <button onclick="openApproveFromStock('${r.id}')" class="text-xs bg-green-600 hover:bg-green-700 text-white font-bold px-2 py-1 rounded">✅ Approve from Stock</button>
                    <button onclick="openOneTimeOrder('${r.id}')" class="text-xs bg-purple-600 hover:bg-purple-700 text-white font-bold px-2 py-1 rounded">🛒 One-Time Order</button>
                    <button onclick="rejectRequisition('${r.id}')" class="text-xs bg-red-100 hover:bg-red-200 text-red-700 font-bold px-2 py-1 rounded">✖ Reject</button>
                </div>`;
        } else if (r.status !== 'pending') {
            actions = `<span class="text-xs text-gray-500">${r.fulfillmentNote || ''}</span>`;
        }
        return `
            <tr class="hover:bg-gray-50 align-top">
                <td class="px-4 py-3 text-sm font-medium">${r.vehicle || ''}<br><span class="text-xs text-gray-500">${r.plate || 'N/A'}</span></td>
                <td class="px-4 py-3 text-sm">${r.itemAction || '—'}</td>
                <td class="px-4 py-3 text-sm font-semibold text-indigo-700">${r.partsText || ''}</td>
                <td class="px-4 py-3 text-sm">${r.mechanic || 'Unassigned'}</td>
                <td class="px-4 py-3 text-sm"><span class="px-2 py-1 rounded-full text-xs font-bold capitalize ${badgeCls}">${statusLabel}</span></td>
                <td class="px-4 py-3 text-sm">${actions}</td>
            </tr>`;
    }).join('');
}

function listenForPendingInventory() {
    const q = query(getPendingInventoryRef(), orderBy('createdAt', 'desc'));
    onSnapshot(q, snapshot => {
        _allPendingInventory = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderPendingInventory();
        updateRequestsBadge();
    }, err => console.error('Pending inventory listener error:', err));
}

function renderPendingInventory() {
    const tbody = document.getElementById('pending-inventory-table-body');
    const emptyMsg = document.getElementById('pending-inventory-empty-msg');
    if (!tbody) return;

    if (_allPendingInventory.length === 0) {
        tbody.innerHTML = '';
        if (emptyMsg) emptyMsg.classList.remove('hidden');
        return;
    }
    if (emptyMsg) emptyMsg.classList.add('hidden');

    tbody.innerHTML = _allPendingInventory.map(p => {
        const actions = can('viewFinancials')
            ? `<div class="flex gap-2">
                 <button onclick="openApproveInventory('${p.id}')" class="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2 py-1 rounded">💰 Set Buying Price &amp; Approve</button>
                 <button onclick="rejectPendingInventory('${p.id}')" class="text-xs bg-red-100 hover:bg-red-200 text-red-700 font-bold px-2 py-1 rounded">✖ Reject</button>
               </div>`
            : `<span class="text-xs text-gray-400">Awaiting manager</span>`;
        return `
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 text-sm font-medium">${p.name} (${p.sku || 'N/A'})</td>
                <td class="px-4 py-3 text-sm">${p.quantity}</td>
                <td class="px-4 py-3 text-sm text-green-600">KSh${(p.sellingPrice ?? 0).toFixed(2)}</td>
                <td class="px-4 py-3 text-sm">${p.loggedBy || '—'}</td>
                <td class="px-4 py-3 text-sm">${actions}</td>
            </tr>`;
    }).join('');
}

// ── Generic modal plumbing ──────────────────────────────────────────
const reqModal        = document.getElementById('reqActionModal');
const reqModalTitle   = document.getElementById('reqActionTitle');
const reqModalBody    = document.getElementById('reqActionBody');
const reqModalMsg     = document.getElementById('reqActionMsg');
const reqModalConfirm = document.getElementById('reqActionConfirm');
const reqModalCancel  = document.getElementById('reqActionCancel');

function openReqModal(title, bodyHtml, onConfirm) {
    if (!reqModal) return;
    reqModalTitle.textContent = title;
    reqModalBody.innerHTML = bodyHtml;
    reqModalMsg.textContent = '';
    reqModal.classList.remove('hidden');
    reqModal.classList.add('flex');
    reqModalConfirm.onclick = async () => {
        reqModalConfirm.disabled = true;
        try {
            await onConfirm();
            closeReqModal();
        } catch (err) {
            reqModalMsg.textContent = `❌ ${err.message}`;
            reqModalMsg.className = 'text-red-600 text-sm mt-2';
        } finally {
            reqModalConfirm.disabled = false;
        }
    };
}
function closeReqModal() {
    reqModal.classList.add('hidden');
    reqModal.classList.remove('flex');
}
reqModalCancel?.addEventListener('click', closeReqModal);

// ── Action 1: Approve requisition straight from existing inventory ──
window.openApproveFromStock = (reqId) => {
    const req = _allRequisitions.find(r => r.id === reqId);
    if (!req) return;
    const options = allPartsInventory.filter(p => p.quantity > 0)
        .map(p => `<option value="${p.id}">${p.name} (Stock: ${p.quantity}) — KSh${(p.sellingPrice ?? 0).toFixed(2)}</option>`).join('');
    if (!options) {
        alert('No parts currently in stock. Use "One-Time Order" instead.');
        return;
    }
    openReqModal(`Approve from Stock — ${req.partsText}`, `
        <p class="text-sm text-gray-600">For <strong>${req.vehicle || ''} (${req.plate})</strong>, job: ${req.itemAction || ''}</p>
        <label class="block text-sm font-medium text-gray-700">Matching Inventory Part</label>
        <select id="reqApprovePartSelect" class="w-full p-2 border rounded-lg">${options}</select>
        <label class="block text-sm font-medium text-gray-700">Quantity to Issue</label>
        <input id="reqApproveQty" type="number" min="1" value="1" class="w-full p-2 border rounded-lg">
    `, async () => {
        const partId = document.getElementById('reqApprovePartSelect').value;
        const qty = parseInt(document.getElementById('reqApproveQty').value) || 0;
        const part = allPartsInventory.find(p => p.id === partId);
        if (!part) throw new Error('Part not found.');
        if (qty <= 0 || qty > part.quantity) throw new Error(`Only ${part.quantity} unit(s) in stock.`);

        const partRef = garageDoc(db, doc, 'partsInventory', partId);
        const reqRef  = garageDoc(db, doc, 'partsRequisitions', reqId);
        const transRef  = doc(getDailyTransactionsRef());
        const ledgerRef = doc(getInventoryLedgerRef());
        const totalIncome  = (part.sellingPrice ?? 0) * qty;
        const totalExpense = (part.supplierPrice ?? 0) * qty;
        const totalProfit  = totalIncome - totalExpense;

        await runTransaction(db, async (t) => {
            const snap = await t.get(partRef);
            if (!snap.exists()) throw new Error('Part no longer exists.');
            const liveStock = snap.data().quantity ?? 0;
            if (qty > liveStock) throw new Error(`Only ${liveStock} unit(s) left in stock.`);
            t.update(partRef, { quantity: liveStock - qty });
            t.update(reqRef, {
                status: 'approved',
                fulfillmentNote: `${qty} x ${part.name} issued from stock`,
                fulfilledAt: serverTimestamp(),
                fulfilledBy: `${getSession().role}@${getSession().garageCode}`,
                resolvedPartId: partId,
                resolvedPartName: part.name,
                resolvedQty: qty,
                resolvedSellingPrice: part.sellingPrice ?? 0,
                resolvedSupplierPrice: part.supplierPrice ?? 0
            });
            t.set(transRef, {
                type: 'PART SALE', subtype: part.name, plate: req.plate,
                description: `${qty} x ${part.name} → Requisition for ${req.vehicle} (Plate: ${req.plate})`,
                income: totalIncome, expense: totalExpense, profit: totalProfit,
                timestamp: serverTimestamp(), isJob: true, date: getUTCDateString()
            });
            t.set(ledgerRef, {
                partId, partName: part.name, quantitySold: qty,
                issuedTo: req.mechanic || 'Job Requisition', vehiclePlate: req.plate,
                purpose: `Requisition: ${req.itemAction || req.partsText}`,
                sellingPrice: part.sellingPrice, supplierPrice: part.supplierPrice,
                totalIncome, totalExpense, totalProfit,
                issuedBy: sessionStorage.getItem('userRole') || 'unknown',
                timestamp: serverTimestamp(), date: getUTCDateString(),
                requisitionId: reqId
            });
        });
    });
};

// ── Action 2: One-time special order for parts not held in stock ───
window.openOneTimeOrder = (reqId) => {
    const req = _allRequisitions.find(r => r.id === reqId);
    if (!req) return;
    openReqModal(`One-Time Order — ${req.partsText}`, `
        <p class="text-sm text-gray-600">For <strong>${req.vehicle || ''} (${req.plate})</strong>, job: ${req.itemAction || ''}</p>
        <label class="block text-sm font-medium text-gray-700">Part Description</label>
        <input id="otoName" type="text" value="${req.partsText || ''}" class="w-full p-2 border rounded-lg">
        <label class="block text-sm font-medium text-gray-700">Quantity</label>
        <input id="otoQty" type="number" min="1" value="1" class="w-full p-2 border rounded-lg">
        <label class="block text-sm font-medium text-gray-700">Buying / Supplier Price (per unit)</label>
        <input id="otoCost" type="number" min="0" step="0.01" class="w-full p-2 border rounded-lg">
        <label class="block text-sm font-medium text-gray-700">Selling Price (per unit, charged to client)</label>
        <input id="otoPrice" type="number" min="0" step="0.01" class="w-full p-2 border rounded-lg">
        <p class="text-xs text-gray-500">This part is a one-off special order — it is recorded in Finance &amp; the Ledger but is <strong>not</strong> added to permanent inventory.</p>
    `, async () => {
        const name  = document.getElementById('otoName').value.trim();
        const qty   = parseInt(document.getElementById('otoQty').value) || 0;
        const cost  = parseFloat(document.getElementById('otoCost').value);
        const price = parseFloat(document.getElementById('otoPrice').value);
        if (!name || qty <= 0 || isNaN(cost) || isNaN(price)) throw new Error('Please fill in all fields.');

        const reqRef    = garageDoc(db, doc, 'partsRequisitions', reqId);
        const transRef  = doc(getDailyTransactionsRef());
        const ledgerRef = doc(getInventoryLedgerRef());
        const totalIncome  = price * qty;
        const totalExpense = cost * qty;
        const totalProfit  = totalIncome - totalExpense;

        const batch = writeBatch(db);
        batch.update(reqRef, {
            status: 'one-time-ordered',
            fulfillmentNote: `${qty} x ${name} — special order`,
            fulfilledAt: serverTimestamp(),
            fulfilledBy: `${getSession().role}@${getSession().garageCode}`
        });
        batch.set(transRef, {
            type: 'ONE-TIME PART ORDER', subtype: name, plate: req.plate,
            description: `${qty} x ${name} (special order) → ${req.vehicle} (Plate: ${req.plate})`,
            income: totalIncome, expense: totalExpense, profit: totalProfit,
            timestamp: serverTimestamp(), isJob: true, date: getUTCDateString()
        });
        batch.set(ledgerRef, {
            partId: null, partName: name, quantitySold: qty,
            issuedTo: req.mechanic || 'Job Requisition', vehiclePlate: req.plate,
            purpose: `One-Time Order: ${req.itemAction || ''}`,
            sellingPrice: price, supplierPrice: cost,
            totalIncome, totalExpense, totalProfit,
            issuedBy: sessionStorage.getItem('userRole') || 'unknown',
            timestamp: serverTimestamp(), date: getUTCDateString(),
            requisitionId: reqId, oneTime: true
        });
        await batch.commit();
    });
};

window.rejectRequisition = async (reqId) => {
    if (!confirm('Reject this parts requisition?')) return;
    try {
        await updateDoc(garageDoc(db, doc, 'partsRequisitions', reqId), {
            status: 'rejected',
            fulfillmentNote: 'Rejected by manager',
            fulfilledAt: serverTimestamp(),
            fulfilledBy: `${getSession().role}@${getSession().garageCode}`
        });
    } catch (err) {
        alert(`Failed to reject: ${err.message}`);
    }
};

// ── Action 3: Approve a pending inventory item by setting buying price ──
window.openApproveInventory = (pendingId) => {
    const p = _allPendingInventory.find(x => x.id === pendingId);
    if (!p) return;
    openReqModal(`Approve Into Stock — ${p.name}`, `
        <p class="text-sm text-gray-600">Qty: <strong>${p.quantity}</strong> &nbsp;|&nbsp; Selling Price: <strong>KSh${(p.sellingPrice ?? 0).toFixed(2)}</strong></p>
        <label class="block text-sm font-medium text-gray-700">Buying / Supplier Price (per unit)</label>
        <input id="invApproveCost" type="number" min="0" step="0.01" class="w-full p-2 border rounded-lg">
        <p class="text-xs text-gray-500">This price stays hidden from the Inventory view — only used for profit calculations.</p>
    `, async () => {
        const cost = parseFloat(document.getElementById('invApproveCost').value);
        if (isNaN(cost) || cost < 0) throw new Error('Enter a valid buying price.');
        if (cost > p.sellingPrice) {
            if (!confirm(`Warning: Buying price (KSh${cost.toFixed(2)}) exceeds selling price (KSh${p.sellingPrice.toFixed(2)}). Continue?`)) {
                throw new Error('Cancelled.');
            }
        }
        const batch = writeBatch(db);
        const newPartRef = doc(getPartsInventoryRef());
        batch.set(newPartRef, {
            name: p.name, sku: p.sku || '', quantity: p.quantity,
            supplierPrice: cost, sellingPrice: p.sellingPrice,
            createdAt: serverTimestamp(),
            approvedBy: `${getSession().role}@${getSession().garageCode}`
        });
        batch.delete(garageDoc(db, doc, 'pendingInventory', pendingId));
        const ledgerRef = doc(getInventoryLedgerRef());
        batch.set(ledgerRef, {
            partId: newPartRef.id, partName: p.name, quantitySold: 0,
            issuedTo: 'Stock Intake', vehiclePlate: 'N/A',
            purpose: `New stock approved (logged by ${p.loggedBy || 'staff'})`,
            sellingPrice: p.sellingPrice, supplierPrice: cost,
            totalIncome: 0, totalExpense: cost * p.quantity, totalProfit: -(cost * p.quantity),
            issuedBy: sessionStorage.getItem('userRole') || 'unknown',
            timestamp: serverTimestamp(), date: getUTCDateString(), stockIntake: true
        });
        await batch.commit();
    });
};

window.rejectPendingInventory = async (pendingId) => {
    if (!confirm('Reject this pending part? It will not be added to inventory.')) return;
    try {
        await deleteDoc(garageDoc(db, doc, 'pendingInventory', pendingId));
    } catch (err) {
        alert(`Failed to reject: ${err.message}`);
    }
};

// =================================================================
// 6. SUPPLIERS & CONTACTS LOGIC
// =================================================================

addSupplierForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const supplier = {
        name:      document.getElementById('supplier-name').value,
        type:      document.getElementById('supplier-type').value,
        contact:   document.getElementById('supplier-contact').value,
        location:  document.getElementById('supplier-location').value,
        owed:      parseFloat(document.getElementById('supplier-owed').value) || 0,
        createdAt: serverTimestamp()
    };
    try {
        await addDoc(getSuppliersRef(), supplier);
        addSupplierForm.reset();
        alert('Supplier saved successfully!');
    } catch (error) {
        alert('Failed to save supplier.');
        console.error('Supplier Save Error: ', error);
    }
});

function listenForSuppliers() {
    const q = query(getSuppliersRef(), orderBy('name'));
    onSnapshot(q, snapshot => {
        allSuppliers = [];
        suppliersTableBody.innerHTML = '';
        whatsappSupplierSelect.innerHTML = '<option value="">Select Supplier</option>';

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            allSuppliers.push({ id: docSnap.id, ...data });

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50';
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${data.name}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${data.type}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${data.contact}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm ${data.owed > 0 ? 'text-red-600 font-bold' : 'text-green-600'}">KSh${(data.owed ?? 0).toFixed(2)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onclick="editSupplier('${docSnap.id}')" class="text-indigo-600 hover:text-indigo-900 mr-2">Edit</button>
                    <button onclick="deleteSupplier('${docSnap.id}')" class="text-red-600 hover:text-red-900">Delete</button>
                </td>
            `;
            suppliersTableBody.appendChild(tr);

            const option = document.createElement('option');
            option.value = docSnap.id;
            option.textContent = data.name;
            whatsappSupplierSelect.appendChild(option);
        });

        orderWhatsappBtn.disabled = allSuppliers.length === 0;
    }, error => console.error("Error listening to suppliers: ", error));
}

whatsappSupplierSelect.addEventListener('change', () => {
    orderWhatsappBtn.disabled = whatsappSupplierSelect.value === "";
});

orderWhatsappBtn.addEventListener('click', () => {
    const supplierId   = whatsappSupplierSelect.value;
    const suppliesText = suppliesListTextarea.value;

    if (!supplierId || !suppliesText) {
        alert("Please select a supplier and enter the list of supplies.");
        return;
    }

    const supplier = allSuppliers.find(s => s.id === supplierId);
    if (!supplier) { alert("Supplier data not found."); return; }
    if (!supplier.contact) { alert(`Supplier contact not found for ${supplier.name}.`); return; }

    const cleanedContact = cleanPhoneNumber(supplier.contact);
    if (cleanedContact.length < 9) {
        alert(`The contact number for ${supplier.name} seems invalid: ${supplier.contact}`);
        return;
    }

    const message = `*Supply Request for ${supplier.name}*\n\n--- REQUIRED ITEMS ---\n\n${suppliesText}\n\n--- END OF LIST ---\n\n*Garage Manager PRO*`;
    window.open(`https://wa.me/${cleanedContact}?text=${encodeURIComponent(message)}`, '_blank');
});

function editSupplier(id) { alert(`Editing supplier ${id}...`); }
function deleteSupplier(id) {
    if (confirm("Are you sure you want to delete this supplier?")) {
        deleteDoc(garageDoc(db, doc, 'suppliers', id)).catch(e => console.error("Delete Error", e));
    }
}
window.editSupplier   = editSupplier;
window.deleteSupplier = deleteSupplier;

// =================================================================
// 7. RECEIPT & INVOICE LOGIC
// =================================================================

// ── Booked Cars (from the Garage App) + Completion Notifications ──
// The Garage App (index.html) and Garage Management Console (this file)
// share the same Firestore 'cars' collection — garageCol() namespaces it to
// the current garage automatically, so no extra wiring is needed there.
function getCarsRef()          { return garageCol(db, collection, 'cars'); }
function getNotificationsRef() { return garageCol(db, collection, 'notifications'); }

const JOB_STATUSES_MGMT = ['Active', 'Waiting for Parts', 'Awaiting Approval', 'Ready for Collection'];

let allActiveJobCars = [];
let allCompletedJobCars = [];
let allInvoiceNotifications = [];
let _activeJobsFilter = 'active'; // 'active' | 'completed'

function listenForActiveJobCars() {
    const q = query(getCarsRef(), where('status', 'in', JOB_STATUSES_MGMT), orderBy('createdAt', 'desc'));
    onSnapshot(q, snapshot => {
        allActiveJobCars = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        if (_activeJobsFilter === 'active') renderActiveJobsTable();
        if (!document.getElementById('content-accrual')?.classList.contains('hidden')) renderCarProfitability();
    }, err => console.error('Active job cars listener error:', err));

    const qCompleted = query(getCarsRef(), where('status', '==', 'Completed'), orderBy('createdAt', 'desc'));
    onSnapshot(qCompleted, snapshot => {
        allCompletedJobCars = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        if (_activeJobsFilter === 'completed') renderActiveJobsTable();
        if (!document.getElementById('content-accrual')?.classList.contains('hidden')) renderCarProfitability();
    }, err => console.error('Completed job cars listener error:', err));
}

// Has any invoice already been generated against this car?
function carHasInvoice(carId) {
    return allInvoices.some(inv => inv.sourceCarId === carId);
}

function renderActiveJobsTable() {
    const tbody = document.getElementById('active-jobs-table-body');
    const emptyMsg = document.getElementById('active-jobs-empty-msg');
    if (!tbody) return;

    const list = _activeJobsFilter === 'active' ? allActiveJobCars : allCompletedJobCars;

    if (list.length === 0) {
        tbody.innerHTML = '';
        if (emptyMsg) emptyMsg.classList.remove('hidden');
        return;
    }
    if (emptyMsg) emptyMsg.classList.add('hidden');

    tbody.innerHTML = list.map(car => {
        const planItems = (car.repairPlanItems || []).filter(i => !i.revoked);
        const planSummary = planItems.length > 0
            ? `${planItems.length} item${planItems.length === 1 ? '' : 's'} (${planItems.filter(i => i.done).length} done)`
            : '<span class="text-gray-400">None logged</span>';

        // Count approved requisitions for this car — match by carId or plate
        const approvedForCar = _allRequisitions.filter(r =>
            (r.carId === car.id || (r.plate && r.plate === car.plate)) &&
            (r.status === 'approved' || r.status === 'one-time-ordered')
        );
        const approvedPartsNote = approvedForCar.length > 0
            ? `<br><span class="text-xs font-semibold text-green-600">✅ ${approvedForCar.length} part${approvedForCar.length > 1 ? 's' : ''} approved — prices ready</span>`
            : (planItems.some(i => i.parts) ? `<br><span class="text-xs text-amber-600">⚠ Parts not yet approved</span>` : '');

        const invoiced = carHasInvoice(car.id);
        const invoiceBadge = invoiced
            ? `<span class="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">✅ Invoiced</span>`
            : `<span class="px-2 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">⏳ Not yet</span>`;

        const statusBadgeCls = car.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700';

        return `
            <tr class="hover:bg-gray-50 align-top">
                <td class="px-4 py-3 text-sm font-medium">${escapeHtml(car.plate || 'N/A')}<br><span class="text-xs text-gray-500">${escapeHtml(car.make || '')} ${escapeHtml(car.model || '')} (${escapeHtml(String(car.year || 'N/A'))})</span></td>
                <td class="px-4 py-3 text-sm">${escapeHtml(car.clientName || 'N/A')}<br><span class="text-xs text-gray-500">${escapeHtml(car.clientPhone || '')}</span></td>
                <td class="px-4 py-3 text-sm"><span class="px-2 py-1 rounded-full text-xs font-bold ${statusBadgeCls}">${escapeHtml(car.status || '—')}</span></td>
                <td class="px-4 py-3 text-sm">${planSummary}${approvedPartsNote}</td>
                <td class="px-4 py-3 text-sm">${invoiceBadge}</td>
                <td class="px-4 py-3 text-sm">
                    <button onclick="startInvoiceFromCar('${car.id}')" class="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2 py-1 rounded">🧾 ${invoiced ? 'New Invoice' : 'Create Invoice'}</button>
                </td>
            </tr>`;
    }).join('');
}

document.getElementById('active-jobs-filter-active')?.addEventListener('click', () => {
    _activeJobsFilter = 'active';
    document.getElementById('active-jobs-filter-active').className = 'text-xs font-bold px-3 py-1.5 rounded-full bg-indigo-600 text-white';
    document.getElementById('active-jobs-filter-completed').className = 'text-xs font-bold px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200';
    renderActiveJobsTable();
});
document.getElementById('active-jobs-filter-completed')?.addEventListener('click', () => {
    _activeJobsFilter = 'completed';
    document.getElementById('active-jobs-filter-completed').className = 'text-xs font-bold px-3 py-1.5 rounded-full bg-indigo-600 text-white';
    document.getElementById('active-jobs-filter-active').className = 'text-xs font-bold px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200';
    renderActiveJobsTable();
});

// ── Pull a car's details + repair plan into the invoice form ──
window.startInvoiceFromCar = async (carId) => {
    const car = allActiveJobCars.find(c => c.id === carId) || allCompletedJobCars.find(c => c.id === carId);
    if (!car) { alert('Could not find that job — it may have been removed.'); return; }
    document.getElementById('tab-invoices')?.click();
    await prefillInvoiceFromCar(car);
    // Jump to the invoice tab/form so the manager lands on it immediately
    document.getElementById('invoice-creation-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

async function prefillInvoiceFromCar(car) {
    document.getElementById('invoice-client-name').value  = car.clientName || '';
    document.getElementById('invoice-client-phone').value = car.clientPhone || '';
    document.getElementById('invoice-car-plate').value    = car.plate || '';
    document.getElementById('invoice-source-car-id').value = car.id;

    const banner = document.getElementById('invoice-source-car-banner');
    if (banner) {
        banner.textContent = `🔗 Linked to job: ${car.plate || 'N/A'} — ${car.make || ''} ${car.model || ''}`.trim();
        banner.classList.remove('hidden');
    }
    document.getElementById('invoice-clear-source-btn')?.classList.remove('hidden');

    const container = document.getElementById('invoice-items-container');
    container.innerHTML = '';

    // Gather approved requisitions for this car — these have confirmed prices from inventory
    // Match by carId (preferred) or plate (fallback for older requisitions)
    const approvedReqs = _allRequisitions.filter(
        r => (r.carId === car.id || (r.plate && r.plate === car.plate)) &&
             (r.status === 'approved' || r.status === 'one-time-ordered')
    );

    // Build a lookup: partsText (lower) -> { partId, sellingPrice, qty } from approved reqs
    // For "approved from stock" reqs the fulfillmentNote contains "N x PartName issued from stock".
    // We also match parts from allPartsInventory by name for best-effort price autofill.
    function findInventoryPriceByName(name) {
        if (!name) return null;
        const lc = name.toLowerCase().trim();
        return allPartsInventory.find(p => p.name.toLowerCase().trim() === lc) || null;
    }

    const planItems = (car.repairPlanItems || []).filter(i => !i.revoked && i.action);

    if (planItems.length === 0 && approvedReqs.length === 0) {
        addInvoiceItemRow();
        return;
    }

    // Add a row for every approved/ordered part requisition
    // Priority: use resolvedPartId/resolvedSellingPrice saved at approval time (most reliable).
    // Fallback: fuzzy name-match against allPartsInventory.
    for (const req of approvedReqs) {
        // qty: use resolvedQty saved at approval, or parse from fulfillmentNote, or default 1
        let qty = req.resolvedQty || 1;
        if (!req.resolvedQty) {
            const qtyMatch = (req.fulfillmentNote || '').match(/^(\d+)\s*x\s/i);
            if (qtyMatch) qty = parseInt(qtyMatch[1]) || 1;
        }

        if (req.resolvedPartId) {
            // Approved from stock with saved fields — most reliable path
            addInvoiceItemRow({
                type: 'stock', category: 'parts',
                description: req.resolvedPartName || req.partsText,
                partId: req.resolvedPartId,
                qty,
                sellingPrice: req.resolvedSellingPrice ?? 0,
                supplierPrice: req.resolvedSupplierPrice ?? 0
            });
        } else {
            // Older requisition without saved fields — fall back to name match
            const inv = findInventoryPriceByName(req.partsText);
            if (inv) {
                addInvoiceItemRow({ type: 'stock', category: 'parts', description: req.partsText, partId: inv.id, qty, sellingPrice: inv.sellingPrice ?? 0, supplierPrice: inv.supplierPrice ?? 0 });
            } else {
                // One-time order or unmatched — outside row, manager fills price
                addInvoiceItemRow({ type: 'outside', category: 'parts', description: req.resolvedPartName || req.partsText, qty, sellingPrice: 0, supplierPrice: 0 });
            }
        }
    }

    // Add plan parts that have no approved requisition yet (price 0 — manager fills in)
    planItems.forEach(item => {
        if (item.parts && item.parts.trim()) {
            const alreadyCovered = approvedReqs.some(r =>
                (r.partsText || '').toLowerCase().includes(item.parts.toLowerCase()) ||
                item.parts.toLowerCase().includes((r.partsText || '').toLowerCase())
            );
            if (!alreadyCovered) {
                const inv = findInventoryPriceByName(item.parts.trim());
                if (inv) {
                    addInvoiceItemRow({ type: 'stock', category: 'parts', description: item.parts.trim(), partId: inv.id, qty: 1, sellingPrice: inv.sellingPrice ?? 0 });
                } else {
                    addInvoiceItemRow({ type: 'outside', category: 'parts', description: item.parts.trim() });
                }
            }
        }
        // No automatic labor rows — manager adds labor via '+ Add Line Item'
    });

    // If nothing was added at all, add one blank row
    const rows = container.querySelectorAll('.invoice-item-row');
    if (rows.length === 0) addInvoiceItemRow();

    calculateInvoiceTotals();
}

function clearInvoiceSourceCar() {
    document.getElementById('invoice-source-car-id').value = '';
    document.getElementById('invoice-source-car-banner')?.classList.add('hidden');
    document.getElementById('invoice-clear-source-btn')?.classList.add('hidden');
}
document.getElementById('invoice-clear-source-btn')?.addEventListener('click', clearInvoiceSourceCar);
window.clearInvoiceSourceCar = clearInvoiceSourceCar;

function resetInvoiceDiscountVatFields() {
    const discountEnabled = document.getElementById('invoice-discount-enabled');
    if (discountEnabled) discountEnabled.checked = false;
    document.getElementById('invoice-discount-fields')?.classList.add('hidden');
    const discountValue = document.getElementById('invoice-discount-value');
    if (discountValue) discountValue.value = '0';

    // VAT resets back to the garage's default rather than off-and-zero
    applyDefaultVatToInvoiceForm();
}

// ── Completion notifications ("🔔 Jobs awaiting invoicing") ──
function listenForInvoiceNotifications() {
    const q = query(getNotificationsRef(), where('type', '==', 'invoice_needed'), orderBy('createdAt', 'desc'));
    onSnapshot(q, snapshot => {
        allInvoiceNotifications = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderInvoiceNotifications();
    }, err => console.error('Invoice notifications listener error:', err));
}

function renderInvoiceNotifications() {
    const banner = document.getElementById('invoice-notifications-banner');
    const list = document.getElementById('invoice-notifications-list');
    const countBadge = document.getElementById('invoice-notif-count');
    const tabBadge = document.getElementById('invoices-tab-badge');
    if (!banner || !list) return;

    const unresolved = allInvoiceNotifications.filter(n => !n.invoiced);

    if (tabBadge) {
        if (unresolved.length > 0) {
            tabBadge.textContent = String(unresolved.length);
            tabBadge.classList.remove('hidden');
        } else {
            tabBadge.classList.add('hidden');
        }
    }

    if (unresolved.length === 0) {
        banner.classList.add('hidden');
        list.innerHTML = '';
        return;
    }
    banner.classList.remove('hidden');
    if (countBadge) countBadge.textContent = String(unresolved.length);

    list.innerHTML = unresolved.map(n => `
        <div class="flex items-center justify-between bg-white border border-amber-200 rounded-lg p-3">
            <div class="text-sm">
                <span class="font-semibold">${escapeHtml(n.plate || 'N/A')}</span>
                <span class="text-gray-500"> — ${escapeHtml(n.vehicle || '')} · ${escapeHtml(n.clientName || 'N/A')}</span>
            </div>
            <div class="flex gap-2">
                <button onclick="startInvoiceFromNotification('${n.id}')" class="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded">🧾 Create Invoice</button>
                <button onclick="dismissInvoiceNotification('${n.id}')" class="text-xs text-gray-400 hover:text-gray-600 px-2">Dismiss</button>
            </div>
        </div>
    `).join('');
}

window.startInvoiceFromNotification = async (notifId) => {
    const n = allInvoiceNotifications.find(x => x.id === notifId);
    if (!n) return;
    const car = allCompletedJobCars.find(c => c.id === n.carId) || allActiveJobCars.find(c => c.id === n.carId);
    if (car) {
        await prefillInvoiceFromCar(car);
    } else {
        // Fall back to the notification's own snapshot of the job if the car
        // listener hasn't caught up yet (e.g. just-completed job).
        document.getElementById('invoice-client-name').value  = n.clientName || '';
        document.getElementById('invoice-client-phone').value = n.clientPhone || '';
        document.getElementById('invoice-car-plate').value    = n.plate || '';
        document.getElementById('invoice-source-car-id').value = n.carId || '';
        document.getElementById('invoice-source-car-banner')?.classList.remove('hidden');
        document.getElementById('invoice-source-car-banner').textContent = `🔗 Linked to job: ${n.plate || 'N/A'}`;
        document.getElementById('invoice-clear-source-btn')?.classList.remove('hidden');
    }
    document.getElementById('tab-invoices')?.click();
    document.getElementById('invoice-creation-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.dismissInvoiceNotification = async (notifId) => {
    try {
        await updateDoc(garageDoc(db, doc, 'notifications', notifId), {
            invoiced: true, dismissedBy: `${getSession().role}@${getSession().garageCode}`, dismissedAt: serverTimestamp()
        });
    } catch (err) {
        console.error('Failed to dismiss notification:', err);
    }
};

// Called once an invoice tied to a car successfully commits — clears the
// "needs invoicing" badge for that job and resolves any matching notification.
async function markCarAsInvoiced(carId, invoiceId, invoiceNo) {
    try {
        const matching = allInvoiceNotifications.filter(n => n.carId === carId && !n.invoiced);
        for (const n of matching) {
            await updateDoc(garageDoc(db, doc, 'notifications', n.id), {
                invoiced: true, invoiceId, invoiceNo,
                resolvedBy: `${getSession().role}@${getSession().garageCode}`, resolvedAt: serverTimestamp()
            });
        }
    } catch (err) {
        console.error('Failed to resolve invoicing notification:', err);
    }
}


// ── Completed-job deletion requests ("🗑️ Deletion Requests") ──
// Mirrors the invoice_needed notification pattern: staff in the garage app
// no longer delete completed job history directly — they raise a
// 'deletion_request' notification here that a manager must approve.
let allDeletionRequests = [];

function listenForDeletionRequests() {
    const q = query(getNotificationsRef(), where('type', '==', 'deletion_request'), orderBy('createdAt', 'desc'));
    onSnapshot(q, snapshot => {
        allDeletionRequests = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderDeletionRequests();
    }, err => console.error('Deletion requests listener error:', err));
}

function renderDeletionRequests() {
    const pendingBody = document.getElementById('deletion-requests-table-body');
    const pendingEmpty = document.getElementById('deletion-requests-empty-msg');
    const historyBody = document.getElementById('deletion-requests-history-body');
    const historyEmpty = document.getElementById('deletion-requests-history-empty-msg');
    const badge = document.getElementById('deletions-badge');
    if (!pendingBody) return;

    const pending = allDeletionRequests.filter(r => r.status === 'pending');
    const actioned = allDeletionRequests.filter(r => r.status !== 'pending').slice(0, 25);

    if (badge) {
        if (pending.length > 0) { badge.textContent = String(pending.length); badge.classList.remove('hidden'); }
        else badge.classList.add('hidden');
    }

    if (pending.length === 0) {
        pendingBody.innerHTML = '';
        if (pendingEmpty) pendingEmpty.classList.remove('hidden');
    } else {
        if (pendingEmpty) pendingEmpty.classList.add('hidden');
        pendingBody.innerHTML = pending.map(r => {
            const requestedOn = r.createdAt && typeof r.createdAt.toDate === 'function' ? new Date(r.createdAt.toDate()).toLocaleString() : 'Pending…';
            return `
            <tr class="hover:bg-gray-50 align-top">
                <td class="px-4 py-3 text-sm font-medium">${escapeHtml(r.plate || 'N/A')}<br><span class="text-xs text-gray-500">${escapeHtml(r.vehicle || '')}</span></td>
                <td class="px-4 py-3 text-sm">${escapeHtml(r.clientName || 'N/A')}<br><span class="text-xs text-gray-500">${escapeHtml(r.clientPhone || '')}</span></td>
                <td class="px-4 py-3 text-sm">${escapeHtml(r.requestedBy || 'N/A')}</td>
                <td class="px-4 py-3 text-sm text-gray-500">${requestedOn}</td>
                <td class="px-4 py-3 text-sm">
                    <div class="flex flex-col gap-1">
                        <button onclick="approveDeletionRequest('${r.id}')" class="text-xs bg-red-600 hover:bg-red-700 text-white font-bold px-2 py-1 rounded">🗑️ Approve &amp; Delete</button>
                        <button onclick="rejectDeletionRequest('${r.id}')" class="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-2 py-1 rounded">✖ Reject / Keep Job</button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    if (actioned.length === 0) {
        historyBody.innerHTML = '';
        if (historyEmpty) historyEmpty.classList.remove('hidden');
    } else {
        if (historyEmpty) historyEmpty.classList.add('hidden');
        historyBody.innerHTML = actioned.map(r => {
            const outcome = r.status === 'approved'
                ? `<span class="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">🗑️ Deleted</span>`
                : `<span class="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">✖ Rejected — kept</span>`;
            return `
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 text-sm font-medium">${escapeHtml(r.plate || 'N/A')} <span class="text-xs text-gray-500">${escapeHtml(r.vehicle || '')}</span></td>
                <td class="px-4 py-3 text-sm">${outcome}</td>
                <td class="px-4 py-3 text-sm text-gray-500">${escapeHtml(r.resolvedBy || '—')}</td>
            </tr>`;
        }).join('');
    }
}

window.approveDeletionRequest = async (requestId) => {
    const req = allDeletionRequests.find(r => r.id === requestId);
    if (!req) return;
    if (!can('viewFinancials')) { alert('Only a manager can approve job deletions.'); return; }
    if (!confirm(`Permanently delete the job history for ${req.plate || 'this vehicle'}? This cannot be undone.`)) return;

    try {
        // Delete the underlying car document (if it still exists), then resolve the request.
        if (req.carId) {
            await deleteDoc(garageDoc(db, doc, 'cars', req.carId)).catch(err => {
                // Car may already be gone — that's fine, still resolve the request.
                console.warn('Car doc already missing on delete approval:', err.message);
            });
        }
        await updateDoc(garageDoc(db, doc, 'notifications', requestId), {
            status: 'approved',
            resolvedBy: `${getSession().role}@${getSession().garageCode}`,
            resolvedAt: serverTimestamp()
        });
        alert('Job history deleted.');
    } catch (err) {
        console.error('Error approving deletion request:', err);
        alert(`Could not delete job: ${err.message}`);
    }
};

window.rejectDeletionRequest = async (requestId) => {
    const req = allDeletionRequests.find(r => r.id === requestId);
    if (!req) return;
    if (!can('viewFinancials')) { alert('Only a manager can action deletion requests.'); return; }
    if (!confirm(`Reject this deletion request and keep ${req.plate || 'this job'}'s history?`)) return;

    try {
        // Clear the "deletionRequested" flag on the car so staff can request again later if needed.
        if (req.carId) {
            await updateDoc(garageDoc(db, doc, 'cars', req.carId), {
                deletionRequested: false, deletionRequestedAt: null, deletionRequestedBy: null
            }).catch(err => console.warn('Could not clear deletionRequested flag (car may be gone):', err.message));
        }
        await updateDoc(garageDoc(db, doc, 'notifications', requestId), {
            status: 'rejected',
            resolvedBy: `${getSession().role}@${getSession().garageCode}`,
            resolvedAt: serverTimestamp()
        });
    } catch (err) {
        console.error('Error rejecting deletion request:', err);
        alert(`Could not reject request: ${err.message}`);
    }
};

// ── Accrual accounting & per-car profitability ──
// Works entirely from the existing `cars` and `invoices` caches — no new
// collections needed. Accrual period = the linked car's check-in
// (createdAt) month; falls back to the invoice's own issue date when a job
// has no linked car (e.g. a walk-in counter sale).
function monthKeyFromDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabelFromKey(key) {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}
function findCachedCar(carId) {
    if (!carId) return null;
    return allActiveJobCars.find(c => c.id === carId) || allCompletedJobCars.find(c => c.id === carId) || null;
}
function carIntakeDate(car) {
    if (!car) return null;
    if (car.createdAt && typeof car.createdAt.toDate === 'function') return car.createdAt.toDate();
    if (car.createdAt) return new Date(car.createdAt);
    return null;
}
// The accrual period an invoice's revenue/profit should be attributed to.
function accrualMonthKeyForInvoice(inv) {
    const car = findCachedCar(inv.sourceCarId);
    const intake = carIntakeDate(car);
    if (intake) return monthKeyFromDate(intake);
    // No linked job (or car since deleted) — fall back to the invoice's own date.
    if (inv.date) return inv.date.slice(0, 7);
    return null;
}
// The cash-basis period — the month payment was actually receipted.
function cashMonthKeyForInvoice(inv) {
    if (inv.status !== 'paid') return null; // unpaid invoices haven't hit cash basis yet
    if (inv.paidAt && typeof inv.paidAt.toDate === 'function') return monthKeyFromDate(inv.paidAt.toDate());
    if (inv.date) return inv.date.slice(0, 7);
    return null;
}

function renderAccrualMonthlyTable() {
    const tbody = document.getElementById('accrual-monthly-table-body');
    const emptyMsg = document.getElementById('accrual-monthly-empty-msg');
    if (!tbody) return;
    if (!can('viewFinancials')) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-6 text-center text-gray-400">🔒 Financial figures are hidden for your role.</td></tr>`;
        if (emptyMsg) emptyMsg.classList.add('hidden');
        return;
    }

    const months = {}; // key -> { accrualRevenue, accrualProfit, cashRevenue, cashProfit }
    const ensure = (key) => months[key] || (months[key] = { accrualRevenue: 0, accrualProfit: 0, cashRevenue: 0, cashProfit: 0 });

    allInvoices.forEach(inv => {
        const aKey = accrualMonthKeyForInvoice(inv);
        if (aKey) {
            const m = ensure(aKey);
            m.accrualRevenue += inv.total ?? 0;
            m.accrualProfit += inv.totalProfit ?? (inv.total ?? 0);
        }
        const cKey = cashMonthKeyForInvoice(inv);
        if (cKey) {
            const m = ensure(cKey);
            m.cashRevenue += inv.total ?? 0;
            m.cashProfit += inv.totalProfit ?? (inv.total ?? 0);
        }
    });

    const sortedKeys = Object.keys(months).sort().reverse();
    if (sortedKeys.length === 0) {
        tbody.innerHTML = '';
        if (emptyMsg) emptyMsg.classList.remove('hidden');
        return;
    }
    if (emptyMsg) emptyMsg.classList.add('hidden');

    tbody.innerHTML = sortedKeys.map(key => {
        const m = months[key];
        const profitCls = (v) => v >= 0 ? 'text-indigo-600' : 'text-red-600';
        return `
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 text-sm font-medium">${monthLabelFromKey(key)}</td>
                <td class="px-4 py-3 text-sm text-right">KSh${safeToFixed(m.accrualRevenue)}</td>
                <td class="px-4 py-3 text-sm text-right font-semibold ${profitCls(m.accrualProfit)}">KSh${safeToFixed(m.accrualProfit)}</td>
                <td class="px-4 py-3 text-sm text-right text-gray-500">KSh${safeToFixed(m.cashRevenue)}</td>
                <td class="px-4 py-3 text-sm text-right font-semibold ${profitCls(m.cashProfit)}">KSh${safeToFixed(m.cashProfit)}</td>
            </tr>`;
    }).join('');
}

// Per-car profitability: expected profit (set at check-in) vs actual
// invoiced cost/profit, plus a running-cost alert level.
function computeCarProfitability(car) {
    const carInvoices = allInvoices.filter(inv => inv.sourceCarId === car.id);
    const actualRevenue = carInvoices.reduce((s, i) => s + (i.total ?? 0), 0);
    const actualCost = carInvoices.reduce((s, i) => s + (i.totalCost ?? 0), 0);
    const actualProfit = carInvoices.reduce((s, i) => s + (i.totalProfit ?? (i.total ?? 0)), 0);
    const expectedProfit = car.expectedProfit || 0;

    // Running-cost signal from the repair plan's own estimated costs
    // (entered by staff at check-in / while adding repair items) —
    // available even before any invoice exists.
    const estCost = (car.repairPlanItems || []).filter(i => !i.revoked)
        .reduce((s, i) => s + (parseFloat(i.estimatedCost) || 0), 0);

    let alertLevel = 'ok';
    if (expectedProfit > 0) {
        // Once invoiced, judge against real numbers; before that, use the estimate.
        const gauge = carInvoices.length > 0 ? actualCost : estCost;
        const ratio = gauge / expectedProfit;
        if (carInvoices.length > 0 && actualProfit < 0) alertLevel = 'danger';
        else if (ratio >= 1) alertLevel = 'danger';
        else if (ratio >= 0.7) alertLevel = 'warn';
    }

    const intake = carIntakeDate(car);
    return { car, actualRevenue, actualCost, actualProfit, expectedProfit, estCost, alertLevel, invoiced: carInvoices.length > 0, intake };
}

function renderCarProfitability() {
    const tbody = document.getElementById('car-profitability-table-body');
    const emptyMsg = document.getElementById('car-profitability-empty-msg');
    if (!tbody) return;
    if (!can('viewFinancials')) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-6 text-center text-gray-400">🔒 Profitability figures are hidden for your role.</td></tr>`;
        if (emptyMsg) emptyMsg.classList.add('hidden');
        return;
    }

    const search = (document.getElementById('accrual-car-search')?.value || '').trim().toLowerCase();
    const alertFilter = document.getElementById('accrual-car-alert-filter')?.value || 'all';

    const allCars = [...allActiveJobCars, ...allCompletedJobCars].filter(c => c.jobType !== 'GeneralService');
    let rows = allCars.map(computeCarProfitability);

    if (search) {
        rows = rows.filter(r => (r.car.plate || '').toLowerCase().includes(search) || (r.car.clientName || '').toLowerCase().includes(search));
    }
    if (alertFilter === 'danger') rows = rows.filter(r => r.alertLevel === 'danger');
    if (alertFilter === 'warn') rows = rows.filter(r => r.alertLevel === 'warn');

    // Most recently checked-in first
    rows.sort((a, b) => (b.intake?.getTime() || 0) - (a.intake?.getTime() || 0));

    if (rows.length === 0) {
        tbody.innerHTML = '';
        if (emptyMsg) emptyMsg.classList.remove('hidden');
        return;
    }
    if (emptyMsg) emptyMsg.classList.add('hidden');

    const ALERT_BADGE = {
        ok:     '<span class="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">🟢 On track</span>',
        warn:   '<span class="px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">🟠 Approaching loss</span>',
        danger: '<span class="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">🔴 Loss risk</span>'
    };

    tbody.innerHTML = rows.map(r => {
        const monthLabel = r.intake ? r.intake.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : 'N/A';
        const costCell = r.invoiced
            ? `KSh${safeToFixed(r.actualCost)}`
            : `<span class="text-gray-400">Est. KSh${safeToFixed(r.estCost)}</span>`;
        const profitCell = r.invoiced
            ? `<span class="font-semibold ${r.actualProfit >= 0 ? 'text-indigo-600' : 'text-red-600'}">KSh${safeToFixed(r.actualProfit)}</span>`
            : `<span class="text-gray-400">Not yet invoiced</span>`;
        return `
            <tr class="hover:bg-gray-50 align-top">
                <td class="px-4 py-3 text-sm font-medium">${escapeHtml(r.car.plate || 'N/A')}<br><span class="text-xs text-gray-500">${escapeHtml(r.car.make || '')} ${escapeHtml(r.car.model || '')}</span></td>
                <td class="px-4 py-3 text-sm">${monthLabel}</td>
                <td class="px-4 py-3 text-sm">${r.expectedProfit > 0 ? 'KSh' + safeToFixed(r.expectedProfit) : '<span class="text-gray-400">Not set</span>'}</td>
                <td class="px-4 py-3 text-sm">${costCell}</td>
                <td class="px-4 py-3 text-sm">${profitCell}</td>
                <td class="px-4 py-3 text-sm">${ALERT_BADGE[r.alertLevel]}</td>
            </tr>`;
    }).join('');
}

const INVOICE_ITEM_TYPE_LABELS = {
    labor:   '🔧 Labor (100% profit)',
    stock:   '📦 Part from my stock',
    outside: '🌍 Outside / Pass-through (e.g. paint, sourced part)'
};

// Invoice category — separate from cost-basis type. Used purely to group lines
// on the COLLATED invoice ("Parts: KSh X total", "Consumables: KSh Y total", etc).
// Defaults to a sensible value based on cost-basis type, but the manager can
// re-tag any line (e.g. a "stock" item that's really a consumable like brake fluid).
const INVOICE_CATEGORY_LABELS = {
    labor:       '🔧 Labor',
    parts:       '🔩 Parts',
    consumables: '🧴 Consumables'
};
function defaultCategoryForType(type) {
    if (type === 'labor') return 'labor';
    if (type === 'stock') return 'parts';
    return 'consumables'; // 'outside' lines are usually consumables/pass-through
}

function buildStockPartOptionsHtml(selectedId = '') {
    let opts = '<option value="">-- Select stocked part --</option>';
    allPartsInventory.filter(p => p.quantity > 0).forEach(p => {
        const sel = p.id === selectedId ? 'selected' : '';
        opts += `<option value="${p.id}" data-cost="${p.supplierPrice ?? 0}" data-price="${p.sellingPrice ?? 0}" data-stock="${p.quantity}" data-name="${escapeHtml(p.name).replace(/"/g, '&quot;')}" ${sel}>${escapeHtml(p.name)} (Stock: ${p.quantity})</option>`;
    });
    return opts;
}

function invoiceCategorySelectHtml(selectedCategory) {
    return `<select class="invoice-item-category text-xs p-1.5 border rounded-lg bg-white">
        ${Object.entries(INVOICE_CATEGORY_LABELS).map(([val, label]) =>
            `<option value="${val}" ${val === selectedCategory ? 'selected' : ''}>${label}</option>`).join('')}
    </select>`;
}

function addInvoiceItemRow(prefill = null) {
    const container = document.getElementById('invoice-items-container');
    const row = document.createElement('div');
    const initialType = prefill?.type || 'labor';
    const initialCategory = prefill?.category || defaultCategoryForType(initialType);

    // Auto-detect if this is a prefilled row (from a booked car) or a manual row
    const isPrefilled = prefill !== null;

    // Type badge colours
    const typeBadgeColors = { labor: 'bg-blue-50 border-blue-200', stock: 'bg-green-50 border-green-200', outside: 'bg-orange-50 border-orange-200' };
    row.className = `invoice-item-row border rounded-lg p-3 space-y-2 ${typeBadgeColors[initialType] || 'border-gray-200 bg-gray-50'}`;
    row.dataset.type = initialType;
    row.dataset.category = initialCategory;

    // Simplified header: a compact type badge + category (collapsed by default for manual rows)
    // For prefilled rows, show the type as a read-only badge; for manual rows, show a select.
    const typeIconMap = { labor: '🔧', stock: '📦', outside: '🌍' };
    const typeLabelShort = { labor: 'Labor', stock: 'Part (stock)', outside: 'Part / External' };

    if (isPrefilled) {
        // Prefilled: compact badge header, no need for a dropdown
        row.innerHTML = `
            <div class="flex gap-2 items-center">
                <span class="invoice-item-type-badge text-xs font-bold px-2 py-1 rounded-full ${initialType === 'labor' ? 'bg-blue-100 text-blue-700' : initialType === 'stock' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}">${typeIconMap[initialType]} ${typeLabelShort[initialType]}</span>
                <input type="hidden" class="invoice-item-type" value="${initialType}">
                ${invoiceCategorySelectHtml(initialCategory)}
                <button type="button" onclick="this.closest('.invoice-item-row').remove(); calculateInvoiceTotals();" class="delete-item-btn ml-auto p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded text-xs">✕ Remove</button>
            </div>
            <div class="invoice-item-fields"></div>
        `;
    } else {
        // Manual: show the type dropdown so the user can pick
        row.innerHTML = `
            <div class="flex gap-2 items-center flex-wrap">
                <select class="invoice-item-type text-xs font-semibold p-1.5 border rounded-lg bg-white">
                    <option value="labor">🔧 Labor</option>
                    <option value="stock">📦 Part from stock</option>
                    <option value="outside">🌍 Outside / pass-through</option>
                </select>
                ${invoiceCategorySelectHtml(initialCategory)}
                <button type="button" onclick="this.closest('.invoice-item-row').remove(); calculateInvoiceTotals();" class="delete-item-btn ml-auto p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded text-xs">✕</button>
            </div>
            <div class="invoice-item-fields"></div>
        `;
        const typeSelect = row.querySelector('.invoice-item-type');
        typeSelect.value = initialType;
        typeSelect.addEventListener('change', (e) => {
            const newType = e.target.value;
            row.dataset.type = newType;
            row.dataset.category = defaultCategoryForType(newType);
            row.className = `invoice-item-row border rounded-lg p-3 space-y-2 ${typeBadgeColors[newType] || 'border-gray-200 bg-gray-50'}`;
            row.querySelector('.invoice-item-category').value = row.dataset.category;
            renderInvoiceItemFields(row, newType);
        });
    }

    row.querySelector('.invoice-item-category')?.addEventListener('change', (e) => {
        row.dataset.category = e.target.value;
    });

    container.appendChild(row);
    renderInvoiceItemFields(row, initialType, prefill);
    calculateInvoiceTotals();
}

function renderInvoiceItemFields(row, type, prefill = null) {
    row.dataset.type = type;
    const fieldsDiv = row.querySelector('.invoice-item-fields');
    const prefillDesc = prefill?.description ? escapeHtml(prefill.description).replace(/"/g, '&quot;') : '';
    const prefillQty  = prefill?.qty ?? 1;
    const prefillPrice = prefill?.sellingPrice != null ? parseFloat(prefill.sellingPrice).toFixed(2) : '0.00';
    const prefillCost  = prefill?.supplierPrice != null ? parseFloat(prefill.supplierPrice).toFixed(2) : '0.00';

    if (type === 'stock') {
        const stockOptions = buildStockPartOptionsHtml(prefill?.partId || '');
        fieldsDiv.innerHTML = `
            <select class="invoice-item-stock-select w-full p-2 border rounded-lg text-sm">${stockOptions}</select>
            <div class="flex gap-2 items-center mt-1">
                <label class="text-xs text-gray-500 whitespace-nowrap">Qty</label>
                <input type="number" value="${prefillQty}" min="1" class="invoice-item-qty p-2 border rounded-lg w-20 text-sm text-center">
                <label class="text-xs text-gray-500 whitespace-nowrap">Price (KSh)</label>
                <input type="number" value="0.00" min="0" step="0.01" class="invoice-item-unit-price p-2 border rounded-lg flex-grow text-sm">
                <input type="text" value="0.00" class="invoice-item-amount p-2 border rounded-lg w-28 bg-gray-100 text-sm font-semibold text-right" readonly>
            </div>
            ${prefillDesc ? `<p class="text-xs text-indigo-600 mt-0.5">📌 Approved part: <strong>${prefillDesc}</strong></p>` : '<p class="text-xs text-gray-400">Price auto-fills from inventory selection · stock deducted on commit</p>'}
        `;
        const select = fieldsDiv.querySelector('.invoice-item-stock-select');
        const priceInput = fieldsDiv.querySelector('.invoice-item-unit-price');

        // Sync price from the selected option's data-price attribute.
        // If the option has no data-price (e.g. part out of stock / placeholder),
        // fall back to the prefill.sellingPrice that was saved at approval time.
        const prefillSellingPrice = prefill?.sellingPrice ?? 0;
        function syncPriceFromSelection() {
            const opt = select.options[select.selectedIndex];
            const optPrice = opt ? parseFloat(opt.dataset.price ?? '') : NaN;
            if (!isNaN(optPrice) && optPrice > 0) {
                priceInput.value = optPrice.toFixed(2);
            } else if (prefillSellingPrice > 0) {
                // Option not found in dropdown (stock depleted) but we have the saved price
                priceInput.value = prefillSellingPrice.toFixed(2);
            } else {
                priceInput.value = '0.00';
            }
            calculateInvoiceTotals();
        }

        // Run immediately to set price for any pre-selected option (prefilled partId)
        syncPriceFromSelection();
        select.addEventListener('change', syncPriceFromSelection);
    } else if (type === 'outside') {
        fieldsDiv.innerHTML = `
            <input type="text" placeholder="Description (e.g. Car Paint, sourced part)" value="${prefillDesc}" class="invoice-item-desc w-full p-2 border rounded-lg text-sm">
            <div class="flex gap-2 items-center mt-1">
                <label class="text-xs text-gray-500 whitespace-nowrap">Qty</label>
                <input type="number" value="${prefillQty}" min="1" class="invoice-item-qty p-2 border rounded-lg w-20 text-sm text-center">
                <label class="text-xs text-gray-500 whitespace-nowrap">Charged (KSh)</label>
                <input type="number" value="${prefillPrice}" min="0" step="0.01" class="invoice-item-unit-price p-2 border rounded-lg flex-grow text-sm">
                <label class="text-xs text-gray-500 whitespace-nowrap">Cost (KSh)</label>
                <input type="number" value="${prefillCost}" min="0" step="0.01" class="invoice-item-unit-cost p-2 border rounded-lg w-28 text-sm border-orange-300">
            </div>
            <p class="text-xs text-gray-400 mt-0.5">Cost = what you paid (never printed). Profit = Charged − Cost.</p>
        `;
    } else {
        // Labor
        fieldsDiv.innerHTML = `
            <input type="text" placeholder="Description (e.g. Full Service, Brake Job)" value="${prefillDesc}" class="invoice-item-desc w-full p-2 border rounded-lg text-sm">
            <div class="flex gap-2 items-center mt-1">
                <label class="text-xs text-gray-500 whitespace-nowrap">Qty</label>
                <input type="number" value="${prefillQty}" min="1" class="invoice-item-qty p-2 border rounded-lg w-20 text-sm text-center">
                <label class="text-xs text-gray-500 whitespace-nowrap">Rate (KSh)</label>
                <input type="number" value="${prefillPrice}" min="0" step="0.01" class="invoice-item-unit-price p-2 border rounded-lg flex-grow text-sm">
                <input type="text" value="${(prefillQty * parseFloat(prefillPrice)).toFixed(2)}" class="invoice-item-amount p-2 border rounded-lg w-28 bg-gray-100 text-sm font-semibold text-right" readonly>
            </div>
        `;
    }

    fieldsDiv.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', calculateInvoiceTotals);
    });
    calculateInvoiceTotals();
}

// Computes subtotal (sum of line items) and per-category subtotals (for collated PDF).
// Discount/VAT are layered on top of this — see computeInvoiceBreakdown().
function calculateInvoiceTotals() {
    let total = 0, totalCost = 0;

    document.querySelectorAll('#invoice-items-container .invoice-item-row').forEach(row => {
        const type = row.dataset.type;
        const qty  = parseFloat(row.querySelector('.invoice-item-qty')?.value) || 0;
        const unitPrice = parseFloat(row.querySelector('.invoice-item-unit-price')?.value) || 0;
        const lineTotal = qty * unitPrice;
        total += lineTotal;

        if (type === 'stock') {
            const select = row.querySelector('.invoice-item-stock-select');
            const opt = select?.options[select.selectedIndex];
            const cost = opt?.dataset.cost ? parseFloat(opt.dataset.cost) : 0;
            totalCost += cost * qty;
        } else if (type === 'outside') {
            const unitCost = parseFloat(row.querySelector('.invoice-item-unit-cost')?.value) || 0;
            totalCost += unitCost * qty;
        }

        const amountField = row.querySelector('.invoice-item-amount');
        if (amountField) amountField.value = lineTotal.toFixed(2);
    });

    const summaryBox = document.getElementById('invoice-profit-summary');
    if (summaryBox) {
        if (total > 0 || totalCost > 0) {
            summaryBox.classList.remove('hidden');
            document.getElementById('invoice-summary-cost').textContent   = `KSh${totalCost.toFixed(2)}`;
            document.getElementById('invoice-summary-profit').textContent = `KSh${(total - totalCost).toFixed(2)}`;
        } else {
            summaryBox.classList.add('hidden');
        }
    }

    renderInvoiceBreakdown(total);
    return total;
}

// ── Discount + VAT breakdown ────────────────────────────────────────
// Given a subtotal, applies the discount and VAT (reading current form state)
// in whichever order the manager chose, and returns every figure needed for
// both the on-screen breakdown and the saved invoice document.
function computeInvoiceBreakdown(subtotal) {
    const discountEnabled = document.getElementById('invoice-discount-enabled')?.checked || false;
    const discountType    = document.getElementById('invoice-discount-type')?.value || 'percent';
    const discountValueRaw = parseFloat(document.getElementById('invoice-discount-value')?.value) || 0;

    const vatEnabled = document.getElementById('invoice-vat-enabled')?.checked || false;
    const vatRate     = parseFloat(document.getElementById('invoice-vat-rate')?.value) || 0;
    const vatOrder    = document.getElementById('invoice-vat-order')?.value || 'after-discount';

    let discountAmount = 0;
    if (discountEnabled && discountValueRaw > 0) {
        discountAmount = discountType === 'percent'
            ? subtotal * (discountValueRaw / 100)
            : discountValueRaw;
        discountAmount = Math.min(discountAmount, subtotal); // never discount below zero
    }

    let vatAmount = 0;
    let vatBase = subtotal;
    if (vatEnabled && vatRate > 0) {
        vatBase = vatOrder === 'before-discount' ? subtotal : (subtotal - discountAmount);
        vatAmount = vatBase * (vatRate / 100);
    }

    const grandTotal = subtotal - discountAmount + vatAmount;

    return {
        subtotal,
        discountEnabled, discountType, discountValue: discountValueRaw, discountAmount,
        vatEnabled, vatRate, vatOrder, vatAmount, vatBase,
        grandTotal
    };
}

function renderInvoiceBreakdown(subtotal) {
    const b = computeInvoiceBreakdown(subtotal);

    document.getElementById('invoice-breakdown-subtotal').textContent = `KSh${b.subtotal.toFixed(2)}`;

    const discountRow = document.getElementById('invoice-breakdown-discount-row');
    if (discountRow) {
        discountRow.classList.toggle('hidden', !(b.discountEnabled && b.discountAmount > 0));
        document.getElementById('invoice-breakdown-discount').textContent = `-KSh${b.discountAmount.toFixed(2)}`;
    }

    const vatRow = document.getElementById('invoice-breakdown-vat-row');
    if (vatRow) {
        vatRow.classList.toggle('hidden', !(b.vatEnabled && b.vatRate > 0));
        document.getElementById('invoice-breakdown-vat-label').textContent = `VAT (${b.vatRate}%)`;
        document.getElementById('invoice-breakdown-vat').textContent = `KSh${b.vatAmount.toFixed(2)}`;
    }

    document.getElementById('invoice-total-display').textContent = `KSh${b.grandTotal.toFixed(2)}`;
    return b;
}

// Toggle discount/VAT input visibility + recalc on every relevant change
['invoice-discount-enabled', 'invoice-discount-type', 'invoice-discount-value',
 'invoice-vat-enabled', 'invoice-vat-rate', 'invoice-vat-order'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', calculateInvoiceTotals);
    document.getElementById(id)?.addEventListener('change', calculateInvoiceTotals);
});
document.getElementById('invoice-discount-enabled')?.addEventListener('change', (e) => {
    document.getElementById('invoice-discount-fields')?.classList.toggle('hidden', !e.target.checked);
});
document.getElementById('invoice-vat-enabled')?.addEventListener('change', (e) => {
    document.getElementById('invoice-vat-fields')?.classList.toggle('hidden', !e.target.checked);
});

// Legacy name kept for the Quotes tab, which still uses the simple (no cost-basis) row layout
function calculateTotal(type) {
    if (type === 'invoice') return calculateInvoiceTotals();
    const container = document.getElementById(`${type}-items-container`);
    const itemRows  = container.querySelectorAll(`.${type}-item-row`);
    let total = 0;
    itemRows.forEach(row => {
        const qty        = parseFloat(row.querySelector(`.${type}-item-qty`).value) || 0;
        const unitPrice  = parseFloat(row.querySelector(`.${type}-item-unit-price`).value) || 0;
        const itemAmount = qty * unitPrice;
        const lineTotal  = row.querySelector(`.${type}-item-amount`);
        if (lineTotal) lineTotal.value = itemAmount.toFixed(2);
        total += itemAmount;
    });
    document.getElementById(`${type}-total-display`).textContent = `KSh${total.toFixed(2)}`;
    return total;
}

invoiceCreationForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const subtotal = calculateInvoiceTotals();
    const items = [];
    const stockDeductions = []; // { partId, partName, qty, costPerUnit, sellPerUnit }
    let totalCost = 0;

    const rows = document.querySelectorAll('#invoice-items-container .invoice-item-row');
    for (const row of rows) {
        const type     = row.dataset.type;
        const category = row.dataset.category || defaultCategoryForType(type);
        const qty  = parseFloat(row.querySelector('.invoice-item-qty')?.value) || 0;
        const unitPrice = parseFloat(row.querySelector('.invoice-item-unit-price')?.value) || 0;
        const lineTotal = qty * unitPrice;
        if (lineTotal <= 0) continue;

        if (type === 'stock') {
            const select = row.querySelector('.invoice-item-stock-select');
            const opt = select?.options[select.selectedIndex];
            if (!opt || !opt.value) { alert('Please select a stocked part for every "Part from my stock" line, or remove the line.'); return; }
            const partId   = opt.value;
            const partName = opt.dataset.name;
            const stock    = parseInt(opt.dataset.stock) || 0;
            const cost     = parseFloat(opt.dataset.cost) || 0;
            if (qty > stock) { alert(`Cannot use ${qty} x ${partName} — only ${stock} in stock.`); return; }
            items.push({ description: partName, quantity: qty, unitPrice, amount: lineTotal, costBasis: 'stock', category });
            stockDeductions.push({ partId, partName, qty, costPerUnit: cost, sellPerUnit: unitPrice });
            totalCost += cost * qty;
        } else if (type === 'outside') {
            const desc = row.querySelector('.invoice-item-desc')?.value || 'Item';
            const unitCost = parseFloat(row.querySelector('.invoice-item-unit-cost')?.value) || 0;
            items.push({ description: desc, quantity: qty, unitPrice, amount: lineTotal, costBasis: 'outside', unitCost, category });
            totalCost += unitCost * qty;
        } else {
            const desc = row.querySelector('.invoice-item-desc')?.value || 'Labor';
            items.push({ description: desc, quantity: qty, unitPrice, amount: lineTotal, costBasis: 'labor', category });
        }
    }

    if (items.length === 0) {
        alert("Please add at least one item to the invoice with a total amount greater than zero.");
        return;
    }

    const breakdown = computeInvoiceBreakdown(subtotal);
    const totalProfit = breakdown.grandTotal - totalCost; // discount reduces profit; VAT is pass-through to the taxman, not profit
    const invoiceMode = document.querySelector('input[name="invoice-mode"]:checked')?.value || 'detailed';
    const sourceCarId = document.getElementById('invoice-source-car-id')?.value || null;

    const invoice = {
        invoiceNo:   `INV-${Date.now().toString().slice(-6)}`,
        clientName:  document.getElementById('invoice-client-name').value,
        clientPhone: document.getElementById('invoice-client-phone').value,
        carPlate:    document.getElementById('invoice-car-plate').value,
        sourceCarId,
        mode: invoiceMode, // 'detailed' | 'collated'
        items,
        subtotal,
        discountEnabled: breakdown.discountEnabled,
        discountType: breakdown.discountType,
        discountValue: breakdown.discountValue,
        discountAmount: breakdown.discountAmount,
        vatEnabled: breakdown.vatEnabled,
        vatRate: breakdown.vatRate,
        vatOrder: breakdown.vatOrder,
        vatAmount: breakdown.vatAmount,
        total: breakdown.grandTotal,
        totalCost, totalProfit,
        status: 'unpaid', receiptId: null,
        date: getUTCDateString(), timestamp: serverTimestamp()
    };

    try {
        const invoiceRef = doc(getInvoicesRef());

        await runTransaction(db, async (transaction) => {
            // Re-check live stock for every "from stock" line before committing anything
            const partSnaps = [];
            for (const sd of stockDeductions) {
                const partRef = garageDoc(db, doc, 'partsInventory', sd.partId);
                const snap = await transaction.get(partRef);
                if (!snap.exists()) throw new Error(`Part "${sd.partName}" no longer exists.`);
                const liveStock = snap.data().quantity ?? 0;
                if (sd.qty > liveStock) throw new Error(`Only ${liveStock} unit(s) of "${sd.partName}" left in stock.`);
                partSnaps.push({ ref: partRef, liveStock, sd });
            }

            transaction.set(invoiceRef, invoice);

            // Parts physically leave the shelf once the job is done, regardless of whether
            // the client has paid yet — so stock is deducted now, but Finance (income/expense/
            // profit) only gets recorded once the invoice is receipted via "Receipt Invoice".
            partSnaps.forEach(({ ref, liveStock, sd }) => {
                transaction.update(ref, { quantity: liveStock - sd.qty });
                const ledgerRef = doc(getInventoryLedgerRef());
                transaction.set(ledgerRef, {
                    partId: sd.partId, partName: sd.partName, quantitySold: sd.qty,
                    issuedTo: invoice.clientName, vehiclePlate: invoice.carPlate || 'N/A',
                    purpose: `Invoice #${invoice.invoiceNo} (unpaid)`,
                    sellingPrice: sd.sellPerUnit, supplierPrice: sd.costPerUnit,
                    totalIncome: sd.sellPerUnit * sd.qty, totalExpense: sd.costPerUnit * sd.qty,
                    totalProfit: (sd.sellPerUnit - sd.costPerUnit) * sd.qty,
                    issuedBy: sessionStorage.getItem('userRole') || 'unknown',
                    timestamp: serverTimestamp(), date: getUTCDateString(),
                });
            });
        });

        // If this invoice was generated from a booked car (Active Jobs panel or a
        // completion notification), mark that link as invoiced so the badges/banner clear.
        if (sourceCarId) {
            await markCarAsInvoiced(sourceCarId, invoiceRef.id, invoice.invoiceNo);
        }

        invoiceCreationForm.reset();
        document.getElementById('invoice-items-container').innerHTML = '';
        addInvoiceItemRow();
        resetInvoiceDiscountVatFields();
        clearInvoiceSourceCar();
        alert(`Invoice #${invoice.invoiceNo} generated — KSh${breakdown.grandTotal.toFixed(2)}.\nIt won't appear in Finance until you click "Receipt Invoice" once the client pays.`);
    } catch (error) {
        alert(`Failed to generate or commit invoice: ${error.message}`);
        console.error('Invoice Creation Error: ', error);
    }
});

let allInvoices = [];

function listenForInvoices() {
    const q = query(getInvoicesRef(), orderBy('timestamp', 'desc'));
    onSnapshot(q, snapshot => {
        allInvoices = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        invoicesTableBody.innerHTML = '';
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50';
            const isPaid = data.status === 'paid';
            const profitCell = can('viewFinancials')
                ? `<td class="px-3 py-2 whitespace-nowrap text-sm font-semibold ${(data.totalProfit ?? data.total ?? 0) >= 0 ? 'text-indigo-600' : 'text-red-600'}">KSh${(data.totalProfit ?? data.total ?? 0).toFixed(2)}</td>`
                : '';
            const statusBadge = isPaid
                ? `<span class="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">✅ Paid</span>`
                : `<span class="px-2 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">⏳ Unpaid</span>`;
            const modeBadge = data.mode === 'collated'
                ? `<span class="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700">Collated</span>`
                : `<span class="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600">Detailed</span>`;
            const receiptAction = isPaid
                ? `<button onclick="generateReceiptPDF('${data.receiptId}')" class="text-green-600 hover:text-green-800 mr-2">Receipt PDF</button>`
                : `<button onclick="openReceiptModal('${docSnap.id}')" class="text-white bg-green-600 hover:bg-green-700 font-bold px-2 py-1 rounded mr-2">🧾 Receipt Invoice</button>`;
            tr.innerHTML = `
                <td class="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">${data.invoiceNo}${modeBadge}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500">${data.date}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500">${data.clientName} / ${data.carPlate}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-green-600 font-bold">KSh${(data.total ?? 0).toFixed(2)}</td>
                ${profitCell}
                <td class="px-3 py-2 whitespace-nowrap text-sm">${statusBadge}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm">
                    ${receiptAction}
                    <button onclick="generateInvoicePDF('${docSnap.id}', '${data.clientPhone}')" class="text-blue-500 hover:text-blue-700 mr-2">PDF/Share</button>
                    <button onclick="deleteInvoice('${docSnap.id}')" class="text-red-500 hover:text-red-700">Delete</button>
                </td>
            `;
            invoicesTableBody.appendChild(tr);
        });
        renderActiveJobsTable(); // keep "Invoiced" badges in sync with the live invoices list
        if (!document.getElementById('content-accrual')?.classList.contains('hidden')) {
            renderCarProfitability();
            renderAccrualMonthlyTable();
        }
    }, error => console.error("Error listening to invoices: ", error));
}



// Groups invoice line items into Labor / Parts / Consumables totals for the
// collated PDF — each group becomes a single printed row, never the individual lines.
function groupInvoiceItemsByCategory(items = []) {
    const groups = { labor: 0, parts: 0, consumables: 0 };
    items.forEach(item => {
        const cat = groups.hasOwnProperty(item.category) ? item.category : defaultCategoryForType(item.costBasis);
        groups[cat] = (groups[cat] || 0) + (item.amount ?? 0);
    });
    return groups;
}

async function generateInvoicePDF(invoiceId, clientPhone) {
       // Guard against missing garage session
    const { garageCode } = getSession();
    if (!garageCode) {
        alert("Garage session expired. Please log out and log in again.");
        return;
    }
    try {
        const docSnap = await getDoc(garageDoc(db, doc, 'invoices', invoiceId));
        if (!docSnap.exists()) { alert("Invoice not found."); return; }
        const invoice  = docSnap.data();
        const branding = await getBranding();
        const isCollated = invoice.mode === 'collated';

        // Managers may opt in to printing the profit margin on the PDF — off by default,
        // and never offered to non-managers (they can't see profit anyway).
        const includeProfitOnPdf = can('viewFinancials')
            && confirm('Include your profit margin on this PDF? (Choose "Cancel" to keep the printed invoice client-facing only.)');

        const pdfDoc = new window.jspdf.jsPDF();
        let y = drawPdfHeader(pdfDoc, branding, isCollated ? "INVOICE (SUMMARY)" : "INVOICE");

        pdfDoc.setFontSize(10); pdfDoc.setTextColor(60, 60, 60);
        pdfDoc.text(`Invoice No: ${invoice.invoiceNo}`, 14, y);
        pdfDoc.text(`Date: ${invoice.date}`, 110, y); y += 6;
        pdfDoc.text(`Client: ${invoice.clientName}`, 14, y);
        pdfDoc.text(`Phone: ${invoice.clientPhone}`, 110, y); y += 6;
        pdfDoc.text(`Vehicle Plate: ${invoice.carPlate}`, 14, y); y += 8;

        // ── Line items table: every line (detailed) or grouped totals (collated) ──
        const subtotal = invoice.subtotal ?? invoice.total ?? 0;
        let bodyRows;
        if (isCollated) {
            const groups = groupInvoiceItemsByCategory(invoice.items || []);
            const labels = { labor: '🔧 Labor', parts: '🔩 Parts', consumables: '🧴 Consumables' };
            bodyRows = Object.entries(groups)
                .filter(([, amount]) => amount > 0)
                .map(([cat, amount]) => [labels[cat] || cat, `KSh${amount.toFixed(2)}`]);
        } else {
            bodyRows = (invoice.items || []).map(item => [
                item.description,
                (item.quantity ?? 0).toString(),
                `KSh${(item.unitPrice ?? 0).toFixed(2)}`,
                `KSh${(item.amount   ?? 0).toFixed(2)}`
            ]);
        }

        pdfDoc.autoTable({
            startY: y,
            head: isCollated ? [['Category', 'Amount (KSh)']] : [['Description', 'Qty', 'Unit Price (KSh)', 'Line Total (KSh)']],
            body: bodyRows,
            theme: 'grid', styles: { fontSize: 10 },
            headStyles: { fillColor: hexToRgbArr(branding.primaryColor) }
        });

        // ── Totals breakdown: Subtotal → Discount → VAT → Grand Total ──
        const breakdownRows = [['Subtotal', `KSh${subtotal.toFixed(2)}`]];
        if (invoice.discountEnabled && invoice.discountAmount > 0) {
            const discountLabel = invoice.discountType === 'percent'
                ? `Discount (${invoice.discountValue}%)`
                : 'Discount';
            breakdownRows.push([discountLabel, `-KSh${invoice.discountAmount.toFixed(2)}`]);
        }
        if (invoice.vatEnabled && invoice.vatRate > 0) {
            breakdownRows.push([`VAT (${invoice.vatRate}%)`, `KSh${(invoice.vatAmount ?? 0).toFixed(2)}`]);
        }

        pdfDoc.autoTable({
            startY: pdfDoc.autoTable.previous.finalY + 4,
            body: breakdownRows,
            foot: [['TOTAL', `KSh${(invoice.total ?? 0).toFixed(2)}`]],
            theme: 'plain', styles: { fontSize: 10 },
            footStyles: { fillColor: [230, 230, 255], textColor: [0, 0, 0], fontSize: 12, fontStyle: 'bold' },
            margin: { left: 110 }, tableWidth: 86,
            columnStyles: { 0: { fontStyle: 'normal' }, 1: { halign: 'right' } }
        });

        if (includeProfitOnPdf) {
            const afterTableY = pdfDoc.autoTable.previous.finalY + 8;
            pdfDoc.autoTable({
                startY: afterTableY,
                head: [['Internal — Profit Summary (manager copy only)', 'KSh']],
                body: [
                    ['Total Cost (parts/outside)', (invoice.totalCost ?? 0).toFixed(2)],
                    ['Estimated Profit', (invoice.totalProfit ?? invoice.total ?? 0).toFixed(2)],
                ],
                theme: 'plain', styles: { fontSize: 9, textColor: [150, 80, 0] },
                headStyles: { fillColor: [255, 243, 224], textColor: [150, 80, 0], fontStyle: 'bold' }
            });
        }

        drawPdfFooter(pdfDoc, branding);

        if (clientPhone && clientPhone.trim() && confirm('Share summary via WhatsApp?')) {
            const message = `*${branding.garageName || 'Garage Manager PRO'} Invoice* (No. ${invoice.invoiceNo})\n\nDear ${invoice.clientName},\n\nYour invoice total: *KSh${(invoice.total ?? 0).toFixed(2)}*.\n\nThank you!`;
            window.open(`https://wa.me/${cleanPhoneNumber(clientPhone)}?text=${encodeURIComponent(message)}`, '_blank');
        }

        pdfDoc.save(`Invoice_${invoice.invoiceNo}.pdf`);
    } catch (error) {
        console.error("Invoice PDF/Share Error: ", error);
        alert("Failed to generate or share invoice.");
    }
}

function deleteInvoice(id) {
    if (confirm("Delete this invoice?")) {
        deleteDoc(garageDoc(db, doc, 'invoices', id)).catch(e => console.error("Delete Error", e));
    }
}
window.generateInvoicePDF = generateInvoicePDF;
window.deleteInvoice      = deleteInvoice;

// =================================================================
// 7b. RECEIPT LOGIC — an invoice only hits Finance once receipted
// =================================================================

const receiptModal        = document.getElementById('receiptModal');
const receiptModalBody    = document.getElementById('receiptModalBody');
const receiptModalMsg     = document.getElementById('receiptModalMsg');
const receiptModalConfirm = document.getElementById('receiptModalConfirm');
const receiptModalCancel  = document.getElementById('receiptModalCancel');
let _activeReceiptInvoiceId = null;

function openReceiptModal(invoiceId) {
    _activeReceiptInvoiceId = invoiceId;
    receiptModalMsg.textContent = '';
    document.getElementById('receipt-payment-method').value = 'Cash';

    getDoc(garageDoc(db, doc, 'invoices', invoiceId)).then(snap => {
        if (!snap.exists()) { alert('Invoice not found.'); return; }
        const inv = snap.data();
        const subtotalRow = (inv.discountEnabled || inv.vatEnabled)
            ? `<div class="flex justify-between text-xs text-gray-400"><span>Subtotal</span><span>KSh${(inv.subtotal ?? inv.total ?? 0).toFixed(2)}</span></div>`
            : '';
        const discountRow = (inv.discountEnabled && inv.discountAmount > 0)
            ? `<div class="flex justify-between text-xs text-red-500"><span>Discount</span><span>-KSh${inv.discountAmount.toFixed(2)}</span></div>`
            : '';
        const vatRow = (inv.vatEnabled && inv.vatRate > 0)
            ? `<div class="flex justify-between text-xs text-gray-500"><span>VAT (${inv.vatRate}%)</span><span>KSh${(inv.vatAmount ?? 0).toFixed(2)}</span></div>`
            : '';
        receiptModalBody.innerHTML = `
            <div class="flex justify-between"><span class="text-gray-500">Invoice No.</span><span class="font-semibold">${inv.invoiceNo}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">Client</span><span class="font-semibold">${inv.clientName}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">Vehicle</span><span class="font-semibold">${inv.carPlate || 'N/A'}</span></div>
            ${subtotalRow}${discountRow}${vatRow}
            <div class="flex justify-between text-base pt-2 border-t"><span class="font-bold text-indigo-700">Amount Due</span><span class="font-bold text-green-600">KSh${(inv.total ?? 0).toFixed(2)}</span></div>
        `;
        receiptModal.classList.remove('hidden');
        receiptModal.classList.add('flex');
    }).catch(err => {
        console.error('Error loading invoice for receipt:', err);
        alert('Could not load invoice.');
    });
}
window.openReceiptModal = openReceiptModal;

function closeReceiptModal() {
    receiptModal.classList.add('hidden');
    receiptModal.classList.remove('flex');
    _activeReceiptInvoiceId = null;
}
receiptModalCancel?.addEventListener('click', closeReceiptModal);

receiptModalConfirm?.addEventListener('click', async () => {
    const invoiceId = _activeReceiptInvoiceId;
    if (!invoiceId) return;
    const paymentMethod = document.getElementById('receipt-payment-method').value;

    receiptModalConfirm.disabled = true;
    receiptModalMsg.textContent = '⏳ Committing receipt…';
    receiptModalMsg.className = 'text-sm mt-2 text-gray-500';

    try {
        const invoiceRef = garageDoc(db, doc, 'invoices', invoiceId);
        const receiptRef = doc(getReceiptsRef());
        const transRef    = doc(getDailyTransactionsRef());

        await runTransaction(db, async (transaction) => {
            const invSnap = await transaction.get(invoiceRef);
            if (!invSnap.exists()) throw new Error('Invoice no longer exists.');
            const inv = invSnap.data();
            if (inv.status === 'paid') throw new Error('This invoice has already been receipted.');

            const receipt = {
                receiptNo: `RCT-${Date.now().toString().slice(-6)}`,
                invoiceId, invoiceNo: inv.invoiceNo,
                clientName: inv.clientName, clientPhone: inv.clientPhone || '',
                carPlate: inv.carPlate || 'N/A',
                mode: inv.mode || 'detailed',
                items: inv.items || [],
                subtotal: inv.subtotal ?? inv.total ?? 0,
                discountEnabled: inv.discountEnabled || false,
                discountType: inv.discountType || 'percent',
                discountValue: inv.discountValue || 0,
                discountAmount: inv.discountAmount || 0,
                vatEnabled: inv.vatEnabled || false,
                vatRate: inv.vatRate || 0,
                vatAmount: inv.vatAmount || 0,
                total: inv.total ?? 0, totalCost: inv.totalCost ?? 0, totalProfit: inv.totalProfit ?? (inv.total ?? 0),
                paymentMethod,
                receivedBy: getSession().role,
                date: getUTCDateString(), timestamp: serverTimestamp()
            };

            transaction.set(receiptRef, receipt);
            transaction.update(invoiceRef, { status: 'paid', receiptId: receiptRef.id, paymentMethod, paidAt: serverTimestamp() });
            transaction.set(transRef, {
                type: 'JOB', subtype: 'Invoice/Receipt', plate: inv.carPlate || 'N/A',
                description: `Receipt #${receipt.receiptNo} for Invoice #${inv.invoiceNo} — ${inv.clientName} (${paymentMethod})`,
                income: inv.total ?? 0, expense: inv.totalCost ?? 0, profit: inv.totalProfit ?? (inv.total ?? 0),
                timestamp: serverTimestamp(), isJob: true, date: getUTCDateString()
            });
        });

        closeReceiptModal();
        alert('✅ Payment receipted! Amount now reflected in Finance.');
    } catch (error) {
        receiptModalMsg.textContent = `❌ ${error.message}`;
        receiptModalMsg.className = 'text-red-600 text-sm mt-2';
    } finally {
        receiptModalConfirm.disabled = false;
    }
});

async function generateReceiptPDF(receiptId) {
    if (!receiptId) { alert('No receipt found for this invoice yet.'); return; }
    const { garageCode } = getSession();
    if (!garageCode) { alert("Garage session expired. Please log out and log in again."); return; }
    try {
        const docSnap = await getDoc(garageDoc(db, doc, 'receipts', receiptId));
        if (!docSnap.exists()) { alert("Receipt not found."); return; }
        const receipt  = docSnap.data();
        const branding = await getBranding();
        const isCollated = receipt.mode === 'collated';

        const pdfDoc = new window.jspdf.jsPDF();
        let y = drawPdfHeader(pdfDoc, branding, isCollated ? "PAYMENT RECEIPT (SUMMARY)" : "PAYMENT RECEIPT");

        pdfDoc.setFontSize(10); pdfDoc.setTextColor(60, 60, 60);
        pdfDoc.text(`Receipt No: ${receipt.receiptNo}`, 14, y);
        pdfDoc.text(`Date: ${receipt.date}`, 110, y); y += 6;
        pdfDoc.text(`Invoice No: ${receipt.invoiceNo}`, 14, y);
        pdfDoc.text(`Payment Method: ${receipt.paymentMethod || 'N/A'}`, 110, y); y += 6;
        pdfDoc.text(`Client: ${receipt.clientName}`, 14, y);
        pdfDoc.text(`Vehicle Plate: ${receipt.carPlate}`, 110, y); y += 8;

        const subtotal = receipt.subtotal ?? receipt.total ?? 0;
        let bodyRows;
        if (isCollated) {
            const groups = groupInvoiceItemsByCategory(receipt.items || []);
            const labels = { labor: '🔧 Labor', parts: '🔩 Parts', consumables: '🧴 Consumables' };
            bodyRows = Object.entries(groups)
                .filter(([, amount]) => amount > 0)
                .map(([cat, amount]) => [labels[cat] || cat, `KSh${amount.toFixed(2)}`]);
        } else {
            bodyRows = (receipt.items || []).map(item => [
                item.description,
                (item.quantity ?? 0).toString(),
                `KSh${(item.unitPrice ?? 0).toFixed(2)}`,
                `KSh${(item.amount   ?? 0).toFixed(2)}`
            ]);
        }

        pdfDoc.autoTable({
            startY: y,
            head: isCollated ? [['Category', 'Amount (KSh)']] : [['Description', 'Qty', 'Unit Price (KSh)', 'Line Total (KSh)']],
            body: bodyRows,
            theme: 'grid', styles: { fontSize: 10 },
            headStyles: { fillColor: hexToRgbArr(branding.primaryColor) }
        });

        const breakdownRows = [['Subtotal', `KSh${subtotal.toFixed(2)}`]];
        if (receipt.discountEnabled && receipt.discountAmount > 0) {
            const discountLabel = receipt.discountType === 'percent' ? `Discount (${receipt.discountValue}%)` : 'Discount';
            breakdownRows.push([discountLabel, `-KSh${receipt.discountAmount.toFixed(2)}`]);
        }
        if (receipt.vatEnabled && receipt.vatRate > 0) {
            breakdownRows.push([`VAT (${receipt.vatRate}%)`, `KSh${(receipt.vatAmount ?? 0).toFixed(2)}`]);
        }

        pdfDoc.autoTable({
            startY: pdfDoc.autoTable.previous.finalY + 4,
            body: breakdownRows,
            foot: [['AMOUNT RECEIVED', `KSh${(receipt.total ?? 0).toFixed(2)}`]],
            theme: 'plain', styles: { fontSize: 10 },
            footStyles: { fillColor: [220, 252, 231], textColor: [0, 0, 0], fontSize: 12, fontStyle: 'bold' },
            margin: { left: 110 }, tableWidth: 86,
            columnStyles: { 0: { fontStyle: 'normal' }, 1: { halign: 'right' } }
        });

        pdfDoc.setFontSize(10); pdfDoc.setTextColor(80, 80, 80);
        pdfDoc.text('PAID IN FULL', 14, pdfDoc.autoTable.previous.finalY + 10);

        drawPdfFooter(pdfDoc, branding);
        pdfDoc.save(`Receipt_${receipt.receiptNo}.pdf`);
    } catch (error) {
        console.error("Receipt PDF Error: ", error);
        alert("Failed to generate receipt PDF.");
    }
}
window.generateReceiptPDF = generateReceiptPDF;

// =================================================================
// 8. REPAIR QUOTES LOGIC
// =================================================================

function addQuoteItemRow() {
    const container = document.getElementById('quote-items-container');
    const row = document.createElement('div');
    row.className = 'flex space-x-2 item-row quote-item-row mb-2';
    row.innerHTML = `
        <input type="text" placeholder="Description" class="quote-item-desc form-input flex-grow">
        <input type="number" placeholder="Qty" value="1" min="1" class="quote-item-qty form-input w-24" oninput="calculateTotal('quote')">
        <input type="number" placeholder="Unit Price (KSh)" value="0.00" min="0" step="0.01" class="quote-item-unit-price form-input w-36" oninput="calculateTotal('quote')">
        <input type="text" placeholder="Total Amount (KSh)" value="0.00" class="quote-item-amount form-input w-40 bg-gray-100" readonly>
        <button type="button" onclick="this.parentNode.remove(); calculateTotal('quote');" class="delete-item-btn p-2 text-red-500 hover:text-red-700">X</button>
    `;
    container.appendChild(row);
    calculateTotal('quote');
}

quoteCreationForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const totalAmount = calculateTotal('quote');
    const items = [];

    document.querySelectorAll('#quote-items-container .quote-item-row').forEach(row => {
        const quantity  = parseFloat(row.querySelector('.quote-item-qty').value) || 0;
        const unitPrice = parseFloat(row.querySelector('.quote-item-unit-price').value) || 0;
        const lineTotal = quantity * unitPrice;
        if (lineTotal > 0) {
            items.push({ description: row.querySelector('.quote-item-desc').value, quantity, unitPrice, amount: lineTotal });
        }
    });

    if (items.length === 0) {
        alert("Please add at least one item with an estimated total greater than zero.");
        return;
    }

    const quote = {
        quoteNo:     `QUO-${Date.now().toString().slice(-6)}`,
        clientName:  document.getElementById('quote-client-name').value,
        clientPhone: document.getElementById('quote-client-phone').value,
        carPlate:    document.getElementById('quote-car-plate').value,
        carMake:     document.getElementById('quote-car-make').value,
        items, total: totalAmount,
        date: getUTCDateString(), timestamp: serverTimestamp()
    };

    try {
        await addDoc(getQuotesRef(), quote);
        quoteCreationForm.reset();
        document.getElementById('quote-items-container').innerHTML = '';
        addQuoteItemRow();
        alert('Quote saved successfully!');
    } catch (error) {
        alert('Failed to save quote.');
        console.error('Quote Creation Error: ', error);
    }
});

function listenForQuotes() {
    const q = query(getQuotesRef(), orderBy('timestamp', 'desc'));
    onSnapshot(q, snapshot => {
        quotesTableBody.innerHTML = '';
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50';
            tr.innerHTML = `
                <td class="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">${data.quoteNo}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500">${data.date}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500">${data.clientName} / ${data.carPlate}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-indigo-600 font-bold">KSh${(data.total ?? 0).toFixed(2)} (Est.)</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm">
                    <button onclick="generateQuotePDF('${docSnap.id}', '${data.clientPhone}')" class="text-blue-500 hover:text-blue-700 mr-2">PDF/Share</button>
                    <button onclick="deleteQuote('${docSnap.id}')" class="text-red-500 hover:text-red-700">Delete</button>
                </td>
            `;
            quotesTableBody.appendChild(tr);
        });
    }, error => console.error("Error listening to quotes: ", error));
}

async function generateQuotePDF(quoteId, clientPhone) {
    try {
        const docSnap  = await getDoc(garageDoc(db, doc, 'quotes', quoteId));
        if (!docSnap.exists()) { alert("Quote not found."); return; }
        const quote    = docSnap.data();
        const branding = await getBranding();

        const pdfDoc = new window.jspdf.jsPDF();
        let y = drawPdfHeader(pdfDoc, branding, "REPAIR QUOTE");

        pdfDoc.setFontSize(10); pdfDoc.setTextColor(60, 60, 60);
        pdfDoc.text(`Quote No: ${quote.quoteNo}`, 14, y);
        pdfDoc.text(`Date: ${quote.date}`, 110, y); y += 6;
        pdfDoc.text(`Client: ${quote.clientName}`, 14, y);
        pdfDoc.text(`Phone: ${quote.clientPhone}`, 110, y); y += 6;
        pdfDoc.text(`Vehicle: ${quote.carMake}`, 14, y);
        pdfDoc.text(`Plate: ${quote.carPlate}`, 110, y); y += 8;

        pdfDoc.autoTable({
            startY: y,
            head: [['Item/Service', 'Qty', 'Est. Unit Cost (KSh)', 'Est. Line Total (KSh)']],
            body: quote.items.map(item => [
                item.description,
                (item.quantity ?? 0).toString(),
                `KSh${(item.unitPrice ?? 0).toFixed(2)}`,
                `KSh${(item.amount   ?? 0).toFixed(2)}`
            ]),
            foot: [['', '', 'Estimated Total', `KSh${(quote.total ?? 0).toFixed(2)}`]],
            theme: 'grid', styles: { fontSize: 10 },
            headStyles: { fillColor: hexToRgbArr(branding.primaryColor) },
            footStyles: { fillColor: [230, 230, 255], textColor: [0, 0, 0], fontSize: 12, fontStyle: 'bold' }
        });

        pdfDoc.setFontSize(9); pdfDoc.setTextColor(120, 120, 120);
        pdfDoc.text("NOTE: This is an estimate. Final costs may vary.", 14, pdfDoc.autoTable.previous.finalY + 8);

        drawPdfFooter(pdfDoc, branding);

        if (clientPhone && clientPhone.trim() && confirm('Share summary via WhatsApp?')) {
            const message = `*${branding.garageName || 'Garage Manager PRO'} Repair Quote* (No. ${quote.quoteNo})\n\nDear ${quote.clientName},\n\nYour repair quote for the ${quote.carMake} is *KSh${(quote.total ?? 0).toFixed(2)}* (Estimated).\n\nPlease reply to confirm.`;
            window.open(`https://wa.me/${cleanPhoneNumber(clientPhone)}?text=${encodeURIComponent(message)}`, '_blank');
        }

        pdfDoc.save(`Quote_${quote.quoteNo}.pdf`);
    } catch (error) {
        console.error("Quote PDF/Share Error: ", error);
        alert("Failed to generate or share quote.");
    }
}

function deleteQuote(id) {
    if (confirm("Delete this quote?")) {
        deleteDoc(garageDoc(db, doc, 'quotes', id)).catch(e => console.error("Delete Error", e));
    }
}
window.generateQuotePDF = generateQuotePDF;
window.deleteQuote      = deleteQuote;

window.addInvoiceItemRow = addInvoiceItemRow;
window.addQuoteItemRow   = addQuoteItemRow;
window.calculateTotal    = calculateTotal;

// =================================================================
// 10. BRANDING TAB INITIALIZATION & LIVE PREVIEW
// =================================================================

function hexToRgbArr(hex) {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})KSh/i.exec(hex || '#1d4ed8');
    return r ? [parseInt(r[1],16), parseInt(r[2],16), parseInt(r[3],16)] : [29,78,216];
}

function setupBrandingTab() {
    ['garageName','tagline','phone','email','address'].forEach(f => {
        const el = document.getElementById(`branding-${f}`);
        if (!el) return;
        el.addEventListener('input', updateBrandingPreview);
    });

    ['primaryColor','secondaryColor','accentColor'].forEach(f => {
        const el = document.getElementById(`branding-${f}`);
        if (!el) return;
        el.addEventListener('input', () => {
            const span = document.getElementById(`branding-${f}-hex`);
            if (span) span.textContent = el.value;
            updateColorPreviews();
            updateBrandingPreview();
        });
    });

    const logoInput = document.getElementById('branding-logo-input');
    if (logoInput) {
        logoInput.addEventListener('change', () => {
            const file = logoInput.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                const prev        = document.getElementById('branding-logo-preview');
                const placeholder = document.getElementById('branding-logo-placeholder');
                const previewImg  = document.getElementById('branding-preview-logo-img');
                const previewWrap = document.getElementById('branding-preview-logo-wrap');
                if (prev)        { prev.src = e.target.result; prev.classList.remove('hidden'); }
                if (placeholder)   placeholder.style.display = 'none';
                if (previewImg)    previewImg.src = e.target.result;
                if (previewWrap)   previewWrap.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        });
    }

    loadBrandingForm().then(updateBrandingPreview);
    loadVatSettingsForm();
}

function updateBrandingPreview() {
    const name    = document.getElementById('branding-garageName')?.value || 'Your Garage Name';
    const tagline = document.getElementById('branding-tagline')?.value    || 'Your tagline appears here';
    const phone   = document.getElementById('branding-phone')?.value      || '';
    const email   = document.getElementById('branding-email')?.value      || '';
    const address = document.getElementById('branding-address')?.value    || '';
    const primary = document.getElementById('branding-primaryColor')?.value || '#1d4ed8';

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('branding-preview-name',        name);
    set('branding-preview-tagline',     tagline);
    set('branding-preview-phone',       phone   ? `📞 ${phone}` : '');
    set('branding-preview-email',       email   ? `✉ ${email}`  : '');
    set('branding-preview-footer-left', `${name}${address ? '  |  ' + address : ''}`);

    const footerBar = document.getElementById('branding-footer-preview');
    if (footerBar) footerBar.style.background = primary;

    updateColorPreviews();
}

window.applyColorPreset = function(primary, secondary, accent) {
    const setColor = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
        const span = document.getElementById(`${id}-hex`);
        if (span) span.textContent = val;
    };
    setColor('branding-primaryColor',   primary);
    setColor('branding-secondaryColor', secondary);
    setColor('branding-accentColor',    accent);
    updateColorPreviews();
    updateBrandingPreview();
};

document.addEventListener('DOMContentLoaded', () => {
    // Existing initializations
    if (document.getElementById('invoice-items-container')) addInvoiceItemRow();
    if (document.getElementById('quote-items-container'))   addQuoteItemRow();

    // Branding tab setup
    const brandingTabBtn = document.getElementById('tab-branding');
    if (brandingTabBtn) {
        brandingTabBtn.addEventListener('click', setupBrandingTab);
    }

    // --- NEW: Save permissions button ---
    const savePermBtn = document.getElementById('role-perm-save-btn');
    if (savePermBtn) {
        savePermBtn.addEventListener('click', saveRolePermissions);
    }

    // --- NEW: VAT settings ---
    document.getElementById('vat-settings-save-btn')?.addEventListener('click', saveVatSettings);
});

// =================================================================
// 7c. VAT SETTINGS — garage-wide default, stored on the garage document
// =================================================================
// Stored directly on the garage doc (garages/{garageCode}) rather than
// through garage-branding.js, since that module owns the logo/colour fields
// only. Keeping VAT as its own small read/write keeps this self-contained.

function getDefaultVatSettings() {
    const garageData = window._garageData || {};
    return {
        enabledByDefault: garageData.vatSettings?.enabledByDefault ?? false,
        rate: garageData.vatSettings?.rate ?? 16,
        order: garageData.vatSettings?.order ?? 'after-discount'
    };
}

function loadVatSettingsForm() {
    const vat = getDefaultVatSettings();
    const enabledEl = document.getElementById('settings-vat-enabled-default');
    const rateEl    = document.getElementById('settings-vat-rate');
    const orderEl   = document.getElementById('settings-vat-order');
    if (enabledEl) enabledEl.checked = vat.enabledByDefault;
    if (rateEl)    rateEl.value = vat.rate;
    if (orderEl)   orderEl.value = vat.order;
}

async function saveVatSettings() {
    const msg = document.getElementById('vat-settings-save-msg');
    const garageCode = sessionStorage.getItem('garageCode');
    if (!garageCode) {
        if (msg) { msg.textContent = 'No garage session.'; msg.className = 'text-red-500 text-sm font-semibold mt-2'; }
        return;
    }

    const enabledByDefault = document.getElementById('settings-vat-enabled-default')?.checked || false;
    const rate  = parseFloat(document.getElementById('settings-vat-rate')?.value) || 0;
    const order = document.getElementById('settings-vat-order')?.value || 'after-discount';

    if (msg) { msg.textContent = 'Saving…'; msg.className = 'text-blue-500 text-sm font-semibold mt-2'; }
    try {
        const vatSettings = { enabledByDefault, rate, order };
        await updateDoc(doc(db, 'garages', garageCode), { vatSettings });
        // Keep the in-memory garage data fresh so new invoices pick this up immediately
        window._garageData = { ...(window._garageData || {}), vatSettings };
        if (msg) { msg.textContent = '✅ VAT settings saved.'; msg.className = 'text-green-600 text-sm font-semibold mt-2'; }
        applyDefaultVatToInvoiceForm();
    } catch (err) {
        if (msg) { msg.textContent = `❌ ${err.message}`; msg.className = 'text-red-600 text-sm font-semibold mt-2'; }
    }
}
window.saveVatSettings = saveVatSettings;

// Pre-fills the invoice form's VAT checkbox/rate from the garage default —
// called on boot and whenever a fresh invoice form is started.
function applyDefaultVatToInvoiceForm() {
    const vat = getDefaultVatSettings();
    const enabledEl = document.getElementById('invoice-vat-enabled');
    const rateEl     = document.getElementById('invoice-vat-rate');
    const orderEl    = document.getElementById('invoice-vat-order');
    const fieldsEl    = document.getElementById('invoice-vat-fields');
    const tagEl       = document.getElementById('invoice-vat-default-tag');

    if (enabledEl) enabledEl.checked = vat.enabledByDefault;
    if (rateEl)    rateEl.value = vat.rate;
    if (orderEl)   orderEl.value = vat.order;
    if (fieldsEl)  fieldsEl.classList.toggle('hidden', !vat.enabledByDefault);
    if (tagEl)     tagEl.textContent = vat.rate > 0 ? `(garage default: ${vat.rate}%)` : '';
    calculateInvoiceTotals();
}



// =================================================================
// 11. PIN MANAGEMENT (Manager only — in Garage Settings tab)
// =================================================================

window.savePinSettings = async function() {
    if (!can('managePins')) { alert('Only managers can change PINs.'); return; }
    const garageCode = sessionStorage.getItem('garageCode');
    if (!garageCode) return;

    const btn = document.getElementById('pin-save-btn');
    const msg = document.getElementById('pin-save-msg');
    btn.disabled = true; btn.textContent = 'Saving…';
    msg.textContent = '';

    try {
        const snap     = await getDoc(doc(db, 'garages', garageCode));
        const existing = snap.exists() ? (snap.data().pins || {}) : {};
        const merged   = { ...existing };

        for (const role of ['mechanic', 'admin', 'manager']) {
            const val = document.getElementById(`pin-${role}`)?.value?.trim();
            if (val && val.length >= 4)      merged[role] = val;
            else if (val && val.length > 0) {
                msg.textContent = `❌ ${role} PIN must be at least 4 digits.`;
                msg.className = 'text-red-600 text-sm font-semibold mt-2';
                btn.disabled = false; btn.textContent = 'Save PINs';
                return;
            }
        }

        await updateDoc(doc(db, 'garages', garageCode), { pins: merged });
        msg.textContent = '✅ PINs saved successfully!';
        msg.className = 'text-green-600 text-sm font-semibold mt-2';
        ['mechanic','admin','manager'].forEach(role => {
            const el = document.getElementById(`pin-${role}`);
            if (el) el.value = '';
        });
    } catch (err) {
        msg.textContent = `❌ Error: ${err.message}`;
        msg.className = 'text-red-600 text-sm font-semibold mt-2';
    } finally {
        btn.disabled = false; btn.textContent = 'Save PINs';
    }
};

// =================================================================
// 12. PAYROLL & LABOR MANAGEMENT
//     (Full-Time Employees · Casual/Per-Job Workers · Payment History)
//     Manager-only (gated via can('viewFinancials') at grant-access time)
// =================================================================

function escapeHtmlPR(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m] || m));
}

function sumLineItems(arr = []) {
    return (arr || []).reduce((s, item) => s + (parseFloat(item.amount) || 0), 0);
}

// ── 12.0 — Payroll Sub-Tab Switching ──────────────────────────────
function switchPayrollSubtab(target) {
    document.querySelectorAll('.payroll-subcontent').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.payroll-subtab-btn').forEach(btn => {
        btn.classList.remove('bg-indigo-700', 'text-white');
        btn.classList.add('text-indigo-800');
    });
    const content = document.getElementById(`payroll-subcontent-${target}`);
    const btn     = document.getElementById(`subtab-${target}`);
    if (content) content.classList.remove('hidden');
    if (btn) { btn.classList.add('bg-indigo-700', 'text-white'); btn.classList.remove('text-indigo-800'); }
    if (target === 'payhistory') renderPayHistory();
}
document.getElementById('subtab-employees')?.addEventListener('click', () => switchPayrollSubtab('employees'));
document.getElementById('subtab-casuals')?.addEventListener('click', () => switchPayrollSubtab('casuals'));
document.getElementById('subtab-payhistory')?.addEventListener('click', () => switchPayrollSubtab('payhistory'));

// =================================================================
// 12.1 — FULL-TIME EMPLOYEES
// =================================================================

addEmployeeForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!can('viewFinancials')) { alert('Only managers can manage payroll.'); return; }

    const msgEl = document.getElementById('emp-save-msg');
    const employee = {
        name:         document.getElementById('emp-name').value.trim(),
        position:     document.getElementById('emp-position').value.trim(),
        phone:        document.getElementById('emp-phone').value.trim(),
        idNumber:     document.getElementById('emp-id-no').value.trim(),
        baseSalary:   parseFloat(document.getElementById('emp-base-salary').value) || 0,
        payFrequency: document.getElementById('emp-pay-frequency').value,
        startDate:    document.getElementById('emp-start-date').value || '',
        status:       document.getElementById('emp-status').value,
        deductions:   [],
        benefits:     [],
        penalties:    [],
        createdAt:    serverTimestamp(),
    };

    if (!employee.name || !employee.position) {
        msgEl.textContent = '❌ Name and position are required.';
        msgEl.className = 'text-red-500 text-sm';
        return;
    }

    msgEl.textContent = 'Saving…'; msgEl.className = 'text-blue-500 text-sm';
    try {
        await addDoc(getEmployeesRef(), employee);
        msgEl.textContent = '✅ Employee added successfully!';
        msgEl.className = 'text-green-600 text-sm';
        addEmployeeForm.reset();
        document.getElementById('emp-pay-frequency').value = 'Monthly';
        document.getElementById('emp-status').value = 'Active';
    } catch (err) {
        msgEl.textContent = `❌ Error: ${err.message}`;
        msgEl.className = 'text-red-500 text-sm';
        console.error('Add Employee Error:', err);
    }
});

function listenForEmployees() {
    onSnapshot(query(getEmployeesRef(), orderBy('name', 'asc')), snapshot => {
        allEmployees = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        document.getElementById('employee-count').textContent = allEmployees.length;
        renderEmployeesList(allEmployees);
        populateCasualEarningWorkerSelect(); // no-op safeguard; real population happens in its own listener
        // Keep open modal in sync if an employee is currently being viewed
        if (_currentEmployeeId) {
            const emp = allEmployees.find(e => e.id === _currentEmployeeId);
            if (emp) renderEmployeeModalContent(emp);
        }
    }, err => console.error('Employees listener error:', err));
}

function netPayFor(emp) {
    const benefits   = sumLineItems(emp.benefits);
    const deductions = sumLineItems(emp.deductions);
    const penalties  = sumLineItems(emp.penalties);
    const net = (emp.baseSalary || 0) + benefits - deductions - penalties;
    return { benefits, deductions, penalties, net };
}

function renderEmployeesList(employees) {
    const container = employeesListContainer;
    const noMsg = document.getElementById('no-employees-message');
    const search = (document.getElementById('employee-search')?.value || '').toLowerCase();
    const filtered = employees.filter(emp =>
        emp.name.toLowerCase().includes(search) ||
        (emp.position || '').toLowerCase().includes(search)
    );

    if (filtered.length === 0) {
        container.innerHTML = '';
        if (noMsg) { noMsg.style.display = 'block'; noMsg.textContent = 'No employees found.'; }
        return;
    }
    if (noMsg) noMsg.style.display = 'none';

    const statusColors = {
        'Active':     'bg-green-100 text-green-700',
        'On Leave':   'bg-yellow-100 text-yellow-700',
        'Suspended':  'bg-orange-100 text-orange-700',
        'Terminated': 'bg-red-100 text-red-700',
    };

    container.innerHTML = filtered.map(emp => {
        const { net, penalties } = netPayFor(emp);
        const penaltyFlag = penalties > 0 ? `<span class="text-xs bg-orange-100 text-orange-700 font-bold px-2 py-0.5 rounded-full ml-1">⚠️ KSh${penalties.toFixed(2)} pending</span>` : '';
        return `
            <div class="border rounded-lg p-4 hover:shadow-md transition flex justify-between items-center cursor-pointer" onclick="openEmployeeModal('${emp.id}')">
                <div>
                    <p class="font-bold text-gray-800">${escapeHtmlPR(emp.name)} ${penaltyFlag}</p>
                    <p class="text-sm text-indigo-600">${escapeHtmlPR(emp.position)}</p>
                    <p class="text-xs text-gray-400">${emp.payFrequency || 'Monthly'} · Base: KSh${(emp.baseSalary || 0).toFixed(2)}</p>
                </div>
                <div class="text-right">
                    <span class="text-xs font-semibold px-2 py-1 rounded-full ${statusColors[emp.status] || 'bg-gray-100 text-gray-600'}">${emp.status || 'Active'}</span>
                    <p class="text-sm font-bold text-gray-700 mt-1">Net: KSh${net.toFixed(2)}</p>
                </div>
            </div>`;
    }).join('');
}
window.filterEmployees = () => renderEmployeesList(allEmployees);

// ── Employee Payroll Modal ────────────────────────────────────────

function openEmployeeModal(empId) {
    _currentEmployeeId = empId;
    const emp = allEmployees.find(e => e.id === empId);
    if (!emp) return;
    renderEmployeeModalContent(emp);
    document.getElementById('employeePayrollModal').style.display = 'flex';
}
window.openEmployeeModal = openEmployeeModal;

function closeEmployeeModal() {
    document.getElementById('employeePayrollModal').style.display = 'none';
    _currentEmployeeId = null;
}
window.closeEmployeeModal = closeEmployeeModal;

function renderEmployeeModalContent(emp) {
    document.getElementById('epm-emp-name').textContent = emp.name;
    document.getElementById('epm-emp-position').textContent = `${emp.position} · ${emp.payFrequency || 'Monthly'} · ${emp.status || 'Active'}`;
    document.getElementById('epm-base-salary').value = emp.baseSalary || 0;

    const lineItemRow = (item, idx, type, colorCls) => `
        <div class="flex justify-between items-center bg-white border rounded-lg px-3 py-2">
            <span class="text-sm text-gray-700">${escapeHtmlPR(item.label)}</span>
            <div class="flex items-center gap-2">
                <span class="text-sm font-semibold ${colorCls}">KSh${(parseFloat(item.amount) || 0).toFixed(2)}</span>
                <button onclick="removeEmployeeLineItem('${type}', ${idx})" class="text-gray-400 hover:text-red-500 text-xs font-bold">✕</button>
            </div>
        </div>`;

    document.getElementById('epm-deductions-list').innerHTML = (emp.deductions || []).length
        ? emp.deductions.map((d, i) => lineItemRow(d, i, 'deductions', 'text-red-600')).join('')
        : `<p class="text-xs text-gray-400">No deductions.</p>`;

    document.getElementById('epm-benefits-list').innerHTML = (emp.benefits || []).length
        ? emp.benefits.map((b, i) => lineItemRow(b, i, 'benefits', 'text-green-600')).join('')
        : `<p class="text-xs text-gray-400">No benefits.</p>`;

    document.getElementById('epm-penalties-list').innerHTML = (emp.penalties || []).length
        ? emp.penalties.map((p, i) => lineItemRow(p, i, 'penalties', 'text-orange-600')).join('')
        : `<p class="text-xs text-gray-400">No pending penalties.</p>`;

    updateEmployeeNetPayCalc(emp);
    renderEmployeePayHistory(emp.id);
}

function updateEmployeeNetPayCalc(emp) {
    const { benefits, deductions, penalties, net } = netPayFor(emp);
    document.getElementById('epm-calc-base').textContent       = `KSh${(emp.baseSalary || 0).toFixed(2)}`;
    document.getElementById('epm-calc-benefits').textContent   = `KSh${benefits.toFixed(2)}`;
    document.getElementById('epm-calc-deductions').textContent = `KSh${deductions.toFixed(2)}`;
    document.getElementById('epm-calc-penalties').textContent  = `KSh${penalties.toFixed(2)}`;
    const netEl = document.getElementById('epm-calc-net');
    netEl.textContent = `KSh${net.toFixed(2)}`;
    netEl.className = net >= 0 ? 'text-green-700' : 'text-red-600';
}

window.updateEmployeeBaseSalary = async function () {
    if (!_currentEmployeeId) return;
    const newBase = parseFloat(document.getElementById('epm-base-salary').value) || 0;
    try {
        await updateDoc(garageDoc(db, doc, 'employees', _currentEmployeeId), { baseSalary: newBase });
    } catch (err) {
        alert(`Failed to update base salary: ${err.message}`);
    }
};

window.addEmployeeLineItem = async function (type) {
    if (!_currentEmployeeId) return;
    const labelInput  = document.getElementById(`epm-new-${type === 'deductions' ? 'deduction' : type === 'benefits' ? 'benefit' : 'penalty'}-label`);
    const amountInput = document.getElementById(`epm-new-${type === 'deductions' ? 'deduction' : type === 'benefits' ? 'benefit' : 'penalty'}-amount`);
    const label  = labelInput.value.trim();
    const amount = parseFloat(amountInput.value);

    if (!label || isNaN(amount) || amount <= 0) {
        alert('Please enter a valid label and amount.');
        return;
    }

    const emp = allEmployees.find(e => e.id === _currentEmployeeId);
    if (!emp) return;

    const updated = [...(emp[type] || []), { label, amount, addedAt: new Date().toISOString() }];
    try {
        await updateDoc(garageDoc(db, doc, 'employees', _currentEmployeeId), { [type]: updated });
        labelInput.value = ''; amountInput.value = '';
    } catch (err) {
        alert(`Failed to add ${type.slice(0, -1)}: ${err.message}`);
    }
};

window.removeEmployeeLineItem = async function (type, idx) {
    if (!_currentEmployeeId) return;
    const emp = allEmployees.find(e => e.id === _currentEmployeeId);
    if (!emp) return;
    const updated = (emp[type] || []).filter((_, i) => i !== idx);
    try {
        await updateDoc(garageDoc(db, doc, 'employees', _currentEmployeeId), { [type]: updated });
    } catch (err) {
        alert(`Failed to remove item: ${err.message}`);
    }
};

window.deleteEmployee = async function () {
    if (!_currentEmployeeId) return;
    const emp = allEmployees.find(e => e.id === _currentEmployeeId);
    if (!emp) return;
    if (!confirm(`Remove ${emp.name} from payroll? Past payment history will be kept for records.`)) return;
    try {
        await deleteDoc(garageDoc(db, doc, 'employees', _currentEmployeeId));
        closeEmployeeModal();
    } catch (err) {
        alert(`Failed to remove employee: ${err.message}`);
    }
};

// ── Run Payroll — writes payrollRuns doc + mirrors into dailyTransactions ──
window.runEmployeePayroll = async function () {
    if (!_currentEmployeeId) return;
    if (!can('viewFinancials')) { alert('Only managers can run payroll.'); return; }

    const emp = allEmployees.find(e => e.id === _currentEmployeeId);
    if (!emp) return;

    const { benefits, deductions, penalties, net } = netPayFor(emp);
    const msgEl = document.getElementById('epm-payroll-msg');
    const btn   = document.getElementById('epm-run-payroll-btn');

    if (net <= 0) {
        msgEl.textContent = '❌ Net pay must be greater than KSh0.00 to process.';
        msgEl.className = 'text-sm mt-2 text-center text-red-600 font-semibold';
        return;
    }

    if (!confirm(`Pay ${emp.name} a net amount of KSh${net.toFixed(2)}?\n\nThis records the payment in today's Finance expenses and clears pending penalties for this run.`)) return;

    btn.disabled = true; btn.textContent = 'Processing…';
    msgEl.textContent = '';

    try {
        const empRef     = garageDoc(db, doc, 'employees', _currentEmployeeId);
        const payrollRef = doc(getPayrollRunsRef());
        const transRef    = doc(getDailyTransactionsRef());

        await runTransaction(db, async (transaction) => {
            const empSnap = await transaction.get(empRef);
            if (!empSnap.exists()) throw new Error('Employee record no longer exists.');
            const liveEmp = empSnap.data();

            // Record the payroll run (immutable snapshot of this payment)
            transaction.set(payrollRef, {
                employeeId:   _currentEmployeeId,
                employeeName: liveEmp.name,
                position:     liveEmp.position,
                baseSalary:   liveEmp.baseSalary || 0,
                benefits:     liveEmp.benefits   || [],
                deductions:   liveEmp.deductions || [],
                penalties:    liveEmp.penalties  || [],
                benefitsTotal:   benefits,
                deductionsTotal: deductions,
                penaltiesTotal:  penalties,
                netPay:       net,
                paidBy:       getSession().role,
                paidAt:       serverTimestamp(),
                date:         getUTCDateString(),
            });

            // Mirror into daily transactions — affects today's P&L like every other expense
            transaction.set(transRef, {
                type: 'PAYROLL', subtype: 'Salary Payment', plate: 'N/A',
                description: `Salary paid to ${liveEmp.name} (${liveEmp.position})`,
                income: 0, expense: net, profit: -net,
                timestamp: serverTimestamp(), isJob: false, date: getUTCDateString()
            });

            // Clear pending penalties (they've now been deducted) — base/benefits/deductions persist for next run
            transaction.update(empRef, { penalties: [] });
        });

        msgEl.textContent = `✅ Paid KSh${net.toFixed(2)} to ${emp.name}. Recorded in Finance.`;
        msgEl.className = 'text-sm mt-2 text-center text-green-600 font-semibold';
    } catch (err) {
        msgEl.textContent = `❌ ${err.message}`;
        msgEl.className = 'text-sm mt-2 text-center text-red-600 font-semibold';
        console.error('Run Payroll Error:', err);
    } finally {
        btn.disabled = false; btn.textContent = '💸 Pay Now & Record in Finance';
    }
};

function listenForPayrollRuns() {
    onSnapshot(query(getPayrollRunsRef(), orderBy('paidAt', 'desc')), snapshot => {
        allPayrollRuns = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        if (_currentEmployeeId) renderEmployeePayHistory(_currentEmployeeId);
        renderPayHistory();
    }, err => console.error('Payroll runs listener error:', err));
}

function renderEmployeePayHistory(empId) {
    const container = document.getElementById('epm-history-list');
    if (!container) return;
    const runs = allPayrollRuns.filter(r => r.employeeId === empId);
    if (runs.length === 0) {
        container.innerHTML = `<p class="text-gray-400 text-sm">No payroll history yet.</p>`;
        return;
    }
    container.innerHTML = runs.map(r => {
        const dateStr = r.paidAt?.toDate
            ? r.paidAt.toDate().toLocaleString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : (r.date || 'N/A');
        return `
            <div class="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2 text-sm">
                <span class="text-gray-500">${dateStr}</span>
                <span class="font-bold text-indigo-700">KSh${(r.netPay || 0).toFixed(2)}</span>
            </div>`;
    }).join('');
}

// =================================================================
// 12.2 — CASUAL LABORERS / CONTRACTORS / PER-JOB WORKERS
// =================================================================

addCasualForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!can('viewFinancials')) { alert('Only managers can manage labor records.'); return; }

    const msgEl = document.getElementById('casual-save-msg');
    const worker = {
        name:      document.getElementById('casual-name').value.trim(),
        phone:     document.getElementById('casual-phone').value.trim(),
        role:      document.getElementById('casual-role').value.trim(),
        workerType: document.getElementById('casual-type').value,
        createdAt: serverTimestamp(),
    };
    if (!worker.name) { msgEl.textContent = '❌ Name is required.'; msgEl.className = 'text-red-500 text-sm'; return; }

    msgEl.textContent = 'Saving…'; msgEl.className = 'text-blue-500 text-sm';
    try {
        await addDoc(getCasualWorkersRef(), worker);
        msgEl.textContent = '✅ Worker registered!';
        msgEl.className = 'text-green-600 text-sm';
        addCasualForm.reset();
    } catch (err) {
        msgEl.textContent = `❌ Error: ${err.message}`;
        msgEl.className = 'text-red-500 text-sm';
    }
});

function listenForCasualWorkers() {
    onSnapshot(query(getCasualWorkersRef(), orderBy('name', 'asc')), snapshot => {
        allCasualWorkers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        populateCasualEarningWorkerSelect();
        populateCasualLedgerFilter();
        renderCasualWorkersList();
        renderCasualEarningsLedger();
    }, err => console.error('Casual workers listener error:', err));
}

function populateCasualEarningWorkerSelect() {
    const sel = document.getElementById('casual-earning-worker');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">-- Select Worker --</option>' +
        allCasualWorkers.map(w => `<option value="${w.id}">${escapeHtmlPR(w.name)} (${w.workerType || 'Casual'})</option>`).join('');
    if (current) sel.value = current;
}

function populateCasualLedgerFilter() {
    const sel = document.getElementById('casual-ledger-filter');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="all">All Workers</option>' +
        allCasualWorkers.map(w => `<option value="${w.id}">${escapeHtmlPR(w.name)}</option>`).join('');
    sel.value = current || 'all';
}

// Default the earning date input to today, once at load
const casualEarningDateInput = document.getElementById('casual-earning-date');
if (casualEarningDateInput) casualEarningDateInput.value = getUTCDateString();

logCasualEarningForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!can('viewFinancials')) { alert('Only managers can log earnings.'); return; }

    const msgEl     = document.getElementById('casual-earning-msg');
    const workerId  = document.getElementById('casual-earning-worker').value;
    const amount    = parseFloat(document.getElementById('casual-earning-amount').value);
    const plate     = (document.getElementById('casual-earning-plate').value || '').trim().toUpperCase() || 'N/A';
    const date      = document.getElementById('casual-earning-date').value || getUTCDateString();
    const description = document.getElementById('casual-earning-desc').value.trim();

    if (!workerId) { msgEl.textContent = '❌ Please select a worker.'; msgEl.className = 'text-red-500 text-sm'; return; }
    if (isNaN(amount) || amount <= 0) { msgEl.textContent = '❌ Enter a valid amount.'; msgEl.className = 'text-red-500 text-sm'; return; }

    const worker = allCasualWorkers.find(w => w.id === workerId);
    if (!worker) { msgEl.textContent = '❌ Worker not found.'; msgEl.className = 'text-red-500 text-sm'; return; }

    msgEl.textContent = 'Saving…'; msgEl.className = 'text-blue-500 text-sm';
    try {
        await addDoc(getCasualEarningsRef(), {
            workerId,
            workerName: worker.name,
            amount,
            plate,
            date,
            description: description || '',
            paid: false,
            paidAt: null,
            loggedBy: getSession().role,
            createdAt: serverTimestamp(),
        });
        msgEl.textContent = `✅ KSh${amount.toFixed(2)} logged as due for ${worker.name}.`;
        msgEl.className = 'text-green-600 text-sm';
        logCasualEarningForm.reset();
        document.getElementById('casual-earning-date').value = getUTCDateString();
    } catch (err) {
        msgEl.textContent = `❌ Error: ${err.message}`;
        msgEl.className = 'text-red-500 text-sm';
        console.error('Log Casual Earning Error:', err);
    }
});

function listenForCasualEarnings() {
    onSnapshot(query(getCasualEarningsRef(), orderBy('createdAt', 'desc')), snapshot => {
        allCasualEarnings = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCasualWorkersList();
        renderCasualEarningsLedger();
        renderPayHistory();
    }, err => console.error('Casual earnings listener error:', err));
}

function outstandingDuesFor(workerId) {
    return allCasualEarnings
        .filter(e => e.workerId === workerId && !e.paid)
        .reduce((s, e) => s + (e.amount || 0), 0);
}

function renderCasualWorkersList() {
    const container = casualWorkersListContainer;
    const noMsg = document.getElementById('no-casuals-message');
    if (!container) return;

    if (allCasualWorkers.length === 0) {
        container.innerHTML = '';
        if (noMsg) noMsg.style.display = 'block';
        return;
    }
    if (noMsg) noMsg.style.display = 'none';

    container.innerHTML = allCasualWorkers.map(w => {
        const due = outstandingDuesFor(w.id);
        const dueCls = due > 0 ? 'text-orange-600 font-bold' : 'text-green-600';
        return `
            <div class="flex justify-between items-center bg-gray-50 rounded-lg px-4 py-3">
                <div>
                    <p class="font-semibold text-gray-800">${escapeHtmlPR(w.name)} <span class="text-xs text-gray-400 ml-1">(${w.workerType || 'Casual'})</span></p>
                    <p class="text-xs text-gray-500">${escapeHtmlPR(w.role || 'General Labor')}${w.phone ? ' · ' + escapeHtmlPR(w.phone) : ''}</p>
                </div>
                <div class="text-right flex items-center gap-3">
                    <div>
                        <p class="text-xs text-gray-400">Outstanding Due</p>
                        <p class="${dueCls}">KSh${due.toFixed(2)}</p>
                    </div>
                    ${due > 0 ? `<button onclick="payAllDuesForWorker('${w.id}')" class="bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg">Pay All Due</button>` : ''}
                    <button onclick="deleteCasualWorker('${w.id}','${escapeHtmlPR(w.name)}')" class="text-red-400 hover:text-red-600 text-xs">Remove</button>
                </div>
            </div>`;
    }).join('');
}

window.deleteCasualWorker = async function (workerId, workerName) {
    const due = outstandingDuesFor(workerId);
    if (due > 0) {
        alert(`Cannot remove ${workerName} — they have KSh${due.toFixed(2)} in outstanding dues. Settle their payment first.`);
        return;
    }
    if (!confirm(`Remove ${workerName} from registered workers? Earnings history will be kept.`)) return;
    try {
        await deleteDoc(garageDoc(db, doc, 'casualWorkers', workerId));
    } catch (err) {
        alert(`Failed to remove worker: ${err.message}`);
    }
};

// ── Pay a single earning entry ─────────────────────────────────────
window.markCasualEarningPaid = async function (earningId) {
    if (!can('viewFinancials')) { alert('Only managers can record payments.'); return; }
    const entry = allCasualEarnings.find(e => e.id === earningId);
    if (!entry || entry.paid) return;
    if (!confirm(`Pay ${entry.workerName} KSh${entry.amount.toFixed(2)} for: ${entry.description || 'logged work'}?`)) return;

    try {
        const earningRef = garageDoc(db, doc, 'casualEarnings', earningId);
        const transRef    = doc(getDailyTransactionsRef());

        await runTransaction(db, async (transaction) => {
            const snap = await transaction.get(earningRef);
            if (!snap.exists()) throw new Error('Earning record no longer exists.');
            if (snap.data().paid) throw new Error('This earning has already been paid.');

            transaction.update(earningRef, { paid: true, paidAt: serverTimestamp() });
            transaction.set(transRef, {
                type: 'CASUAL LABOR', subtype: 'Casual/Per-Job Payment', plate: entry.plate || 'N/A',
                description: `Paid ${entry.workerName}: ${entry.description || 'casual labor'} (Plate: ${entry.plate || 'N/A'})`,
                income: 0, expense: entry.amount, profit: -entry.amount,
                timestamp: serverTimestamp(), isJob: false, date: getUTCDateString()
            });
        });
    } catch (err) {
        alert(`Payment failed: ${err.message}`);
        console.error('Mark Casual Earning Paid Error:', err);
    }
};

// ── Pay all outstanding dues for one worker in a single batch ──────
window.payAllDuesForWorker = async function (workerId) {
    if (!can('viewFinancials')) { alert('Only managers can record payments.'); return; }
    const worker = allCasualWorkers.find(w => w.id === workerId);
    const dueEntries = allCasualEarnings.filter(e => e.workerId === workerId && !e.paid);
    if (!worker || dueEntries.length === 0) return;

    const total = dueEntries.reduce((s, e) => s + (e.amount || 0), 0);
    if (!confirm(`Pay ${worker.name} a total of KSh${total.toFixed(2)} across ${dueEntries.length} due entr${dueEntries.length === 1 ? 'y' : 'ies'}?`)) return;

    try {
        const batch = writeBatch(db);
        dueEntries.forEach(entry => {
            batch.update(garageDoc(db, doc, 'casualEarnings', entry.id), { paid: true, paidAt: serverTimestamp() });
        });
        batch.set(doc(getDailyTransactionsRef()), {
            type: 'CASUAL LABOR', subtype: 'Casual/Per-Job Bulk Payment', plate: 'N/A',
            description: `Settled ${dueEntries.length} due payment(s) for ${worker.name}`,
            income: 0, expense: total, profit: -total,
            timestamp: serverTimestamp(), isJob: false, date: getUTCDateString()
        });
        await batch.commit();
        alert(`✅ Paid KSh${total.toFixed(2)} to ${worker.name}.`);
    } catch (err) {
        alert(`Bulk payment failed: ${err.message}`);
        console.error('Pay All Dues Error:', err);
    }
};

window.deleteCasualEarning = async function (earningId) {
    const entry = allCasualEarnings.find(e => e.id === earningId);
    if (!entry) return;
    if (entry.paid) { alert('Paid entries cannot be deleted — they are part of the permanent payment record.'); return; }
    if (!confirm('Delete this unpaid earning entry?')) return;
    try {
        await deleteDoc(garageDoc(db, doc, 'casualEarnings', earningId));
    } catch (err) {
        alert(`Failed to delete entry: ${err.message}`);
    }
};

function renderCasualEarningsLedger() {
    const tbody = casualEarningsTableBody;
    if (!tbody) return;
    const workerFilter = document.getElementById('casual-ledger-filter')?.value || 'all';
    const statusFilter = document.getElementById('casual-ledger-status-filter')?.value || 'all';

    let filtered = allCasualEarnings;
    if (workerFilter !== 'all') filtered = filtered.filter(e => e.workerId === workerFilter);
    if (statusFilter === 'unpaid') filtered = filtered.filter(e => !e.paid);
    if (statusFilter === 'paid')   filtered = filtered.filter(e => e.paid);

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-gray-400">No earnings found.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(e => {
        const statusBadge = e.paid
            ? `<span class="text-xs font-bold px-2 py-1 rounded-full bg-green-100 text-green-700">✅ Paid</span>`
            : `<span class="text-xs font-bold px-2 py-1 rounded-full bg-orange-100 text-orange-700">⏳ Due</span>`;
        const actionBtn = e.paid
            ? `<span class="text-xs text-gray-400">—</span>`
            : `<div class="flex gap-2">
                 <button onclick="markCasualEarningPaid('${e.id}')" class="text-green-600 hover:text-green-800 text-xs font-bold">Pay</button>
                 <button onclick="deleteCasualEarning('${e.id}')" class="text-red-400 hover:text-red-600 text-xs">Delete</button>
               </div>`;
        return `
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 whitespace-nowrap text-xs text-gray-500">${e.date || 'N/A'}</td>
                <td class="px-4 py-3 text-sm font-medium text-gray-900">${escapeHtmlPR(e.workerName)}</td>
                <td class="px-4 py-3 text-sm text-gray-500">${escapeHtmlPR(e.description) || '—'}</td>
                <td class="px-4 py-3 text-sm font-mono">${e.plate && e.plate !== 'N/A' ? escapeHtmlPR(e.plate) : '—'}</td>
                <td class="px-4 py-3 text-sm font-semibold text-gray-800">KSh${(e.amount || 0).toFixed(2)}</td>
                <td class="px-4 py-3 text-sm">${statusBadge}</td>
                <td class="px-4 py-3 text-sm">${actionBtn}</td>
            </tr>`;
    }).join('');
}
window.renderCasualEarningsLedger = renderCasualEarningsLedger;

// =================================================================
// 12.3 — COMBINED PAYMENT HISTORY (Full-Time + Casual)
// =================================================================

function renderPayHistory() {
    const tbody = payhistoryTableBody;
    if (!tbody) return;
    const search = (document.getElementById('payhistory-search')?.value || '').toLowerCase();

    const payrollRows = allPayrollRuns.map(r => ({
        date: r.paidAt?.toDate ? r.paidAt.toDate().toLocaleDateString('en-KE') : (r.date || 'N/A'),
        sortTs: r.paidAt?.toDate ? r.paidAt.toDate().getTime() : 0,
        name: r.employeeName,
        type: 'Full-Time Salary',
        typeColor: 'bg-indigo-100 text-indigo-700',
        details: r.position || '',
        amount: r.netPay || 0,
    }));

    const casualRows = allCasualEarnings.filter(e => e.paid).map(e => ({
        date: e.paidAt?.toDate ? e.paidAt.toDate().toLocaleDateString('en-KE') : (e.date || 'N/A'),
        sortTs: e.paidAt?.toDate ? e.paidAt.toDate().getTime() : 0,
        name: e.workerName,
        type: 'Casual / Per-Job',
        typeColor: 'bg-green-100 text-green-700',
        details: e.description || '',
        amount: e.amount || 0,
    }));

    let rows = [...payrollRows, ...casualRows].sort((a, b) => b.sortTs - a.sortTs);
    if (search) rows = rows.filter(r => r.name.toLowerCase().includes(search));

    // Summary totals
    const totalPayroll     = allPayrollRuns.reduce((s, r) => s + (r.netPay || 0), 0);
    const totalCasualPaid  = allCasualEarnings.filter(e => e.paid).reduce((s, e) => s + (e.amount || 0), 0);
    const totalOutstanding = allCasualEarnings.filter(e => !e.paid).reduce((s, e) => s + (e.amount || 0), 0)
        + allEmployees.reduce((s, emp) => s + sumLineItems(emp.penalties), 0); // unpaid penalties also count as outstanding

    const elPayroll = document.getElementById('ph-total-payroll');
    const elCasual  = document.getElementById('ph-total-casual-paid');
    const elOutstanding = document.getElementById('ph-total-outstanding');
    if (elPayroll) elPayroll.textContent = `KSh${totalPayroll.toFixed(2)}`;
    if (elCasual)  elCasual.textContent  = `KSh${totalCasualPaid.toFixed(2)}`;
    if (elOutstanding) elOutstanding.textContent = `KSh${totalOutstanding.toFixed(2)}`;

    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-gray-400">No payments recorded yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map(r => `
        <tr class="hover:bg-gray-50">
            <td class="px-4 py-3 whitespace-nowrap text-xs text-gray-500">${r.date}</td>
            <td class="px-4 py-3 text-sm font-medium text-gray-900">${escapeHtmlPR(r.name)}</td>
            <td class="px-4 py-3 text-sm"><span class="text-xs font-bold px-2 py-1 rounded-full ${r.typeColor}">${r.type}</span></td>
            <td class="px-4 py-3 text-sm text-gray-500">${escapeHtmlPR(r.details) || '—'}</td>
            <td class="px-4 py-3 text-sm font-semibold text-gray-800">KSh${r.amount.toFixed(2)}</td>
        </tr>`).join('');
}
window.renderPayHistory = renderPayHistory;

// =================================================================
// PIN KEYPAD — wired via addEventListener (not inline onclick).
// Inline onclick="mgmtPinKey(...)" requires a window global, and since
// this file is loaded as a module (<script type="module">), nothing
// here is global unless explicitly assigned to `window`. If anything
// earlier in this module throws (or silently misbehaves) before that
// assignment runs, the rest of the file never executes and the button
// breaks with "mgmtPinKey is not defined". Binding listeners directly
// to the buttons removes that dependency entirely.
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.mgmt-pin-key[data-pin]').forEach(btn => {
        btn.addEventListener('click', () => mgmtPinKey(btn.getAttribute('data-pin')));
    });

    const goBtn = document.getElementById('mgmt-pin-go-btn');
    if (goBtn) goBtn.addEventListener('click', () => enterPinAndLogin());
});
