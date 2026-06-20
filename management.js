// =================================================================
// FILE: management.js  
// Description: Garage Management Console — full logic
// Auth: PIN-based via auth.js (no Firebase email/password)
// =================================================================

// ========== UTILITY FUNCTIONS ==========
function getUTCDateString(date = new Date()) {
    return date.toISOString().split('T')[0];
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
function getQuotesRef()            { return garageCol(db, collection, 'quotes'); }
function getInventoryLedgerRef()   { return garageCol(db, collection, 'inventoryLedger'); }
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
            tr.innerHTML = `<td class="px-4 py-2 font-medium">KSh{roleLabels[role]}</td>`;
            const allowed = perms[role]?.allowedTabs || [];
            tabIds.forEach(tabId => {
                const checked = allowed.includes(tabId) ? 'checked' : '';
                tr.innerHTML += `
                    <td class="px-4 py-2 text-center">
                        <input type="checkbox" class="role-perm-checkbox" data-role="KSh{role}" data-tab="KSh{tabId}" KSh{checked}>
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
        msg.textContent = `❌ Error: KSh{err.message}`;
        msg.className = 'text-red-600 text-sm font-semibold';
    }
}

const ALL_TABS = ['tab-finance', 'tab-payroll', 'tab-inventory', 'tab-suppliers', 'tab-invoices', 'tab-quotes', 'tab-branding'];

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
        badge.className = `text-xs font-bold px-3 py-1 rounded-full KSh{c.cls}`;
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
    listenForInvoices();
    listenForQuotes();
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
        jobProfitDisplay.textContent = `Profit: KShKSh{profit.toFixed(2)}`;
        jobProfitDisplay.className = profit >= 0
            ? 'font-bold text-lg text-green-600'
            : 'font-bold text-lg text-red-600';
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
        description: document.getElementById('job-type').value + (document.getElementById('job-plate').value ? ` for plate KSh{document.getElementById('job-plate').value}` : ''),
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
        jobProfitDisplay.textContent = 'Profit: KSh0.00';
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

function listenForDailyTransactions() {
    const today = getUTCDateString();
    const q = query(getDailyTransactionsRef(), where('date', '==', today), orderBy('timestamp', 'asc'));

    onSnapshot(q, snapshot => {
        currentDailyTransactions = [];
        let totalIncome = 0, totalExpense = 0;
        dailyTransactionsBody.innerHTML = '';

        snapshot.forEach(docSnap => {
            const data = docSnap.data();

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
            tr.innerHTML = `
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500">KSh{displayTime}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900">KSh{escapeHtml(data.subtype || 'Other')}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500">KSh{escapeHtml(data.plate || 'N/A')}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-green-600">KShKSh{safeToFixed(safeIncome)}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-red-600">KShKSh{safeToFixed(safeExpense)}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm KSh{profitClass}">KShKSh{safeToFixed(profit)}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm">
                    <button onclick="deleteTransaction('KSh{docSnap.id}')" class="text-red-500 hover:text-red-700">Delete</button>
                </td>
            `;
            dailyTransactionsBody.appendChild(tr);
        });

        const netProfit = totalIncome - totalExpense;
        summaryIncome.textContent  = `KShKSh{safeToFixed(totalIncome)}`;
        summaryExpense.textContent = `KShKSh{safeToFixed(totalExpense)}`;
        summaryProfit.textContent  = `KShKSh{safeToFixed(netProfit)}`;
        summaryProfit.className    = netProfit >= 0 ? 'font-bold text-indigo-600' : 'font-bold text-red-600';
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

// End Day — uses a transaction to prevent duplicate reports if two sessions click simultaneously
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
        await runTransaction(db, async (transaction) => {
            const existing = await transaction.get(reportRef);
            if (existing.exists()) {
                throw new Error('A report for today already exists. Reload to see it.');
            }

            // Tally from the live cache (already authoritative — onSnapshot keeps it current)
            let totalIncome = 0, totalExpense = 0;
            currentDailyTransactions.forEach(t => {
                totalIncome  += t.income  || 0;
                totalExpense += t.expense || 0;
            });
            const netProfit = totalIncome - totalExpense;

            transaction.set(reportRef, {
                date:         today,
                garageCode,
                totalIncome,
                totalExpense,
                netProfit,
                transactionCount: currentDailyTransactions.length,
                savedAt:      serverTimestamp(),
                savedBy:      getSession().role,
            });
        });

        alert(`Day closed! Net profit: KShKSh{(parseFloat(summaryProfit.textContent.replace('KSh','')) || 0).toFixed(2)}`);
    } catch (err) {
        alert(`Could not save report: KSh{err.message}`);
        console.error('End Day Error:', err);
    } finally {
        endDayBtn.disabled = currentDailyTransactions.length === 0;
        endDayBtn.textContent = 'End Day & Save P&L Report';
    }
});


viewReportsBtn.addEventListener('click', () => {
    reportViewSection.classList.remove('hidden');
    pastReportsList.innerHTML = '<p class="text-gray-500">Loading reports...</p>';

    const q = query(getPastReportsRef(), orderBy('date', 'desc'));
    getDocs(q).then(snapshot => {
        if (snapshot.empty) {
            pastReportsList.innerHTML = '<p class="text-gray-500">No past reports saved.</p>';
            return;
        }

        const monthTotals = {};
        pastReportsList.innerHTML = '';

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const monthKey = data.date.substring(0, 7);
            monthTotals[monthKey] = (monthTotals[monthKey] || 0) + data.netProfit;

            const listItem = document.createElement('div');
            listItem.className = 'flex justify-between items-center p-2 bg-gray-50 rounded-lg shadow-sm';
            listItem.innerHTML = `
                <span class="font-medium">KSh{data.date}</span>
                <span class="KSh{data.netProfit >= 0 ? 'text-green-600' : 'text-red-600'} font-bold">KShKSh{(data.netProfit ?? 0).toFixed(2)}</span>
                <button onclick="generateDailyReportPDF('KSh{docSnap.id}')" class="text-blue-500 hover:text-blue-700 text-sm">Print/View</button>
            `;
            pastReportsList.appendChild(listItem);
        });

        renderFinancialChart(monthTotals);
    }).catch(error => {
        console.error("Error fetching reports: ", error);
        pastReportsList.innerHTML = '<p class="text-red-500">Error loading reports.</p>';
    });
});

function renderFinancialChart(monthTotals) {
    if (plChartInstance) plChartInstance.destroy();

    const sortedMonths = Object.keys(monthTotals).sort();
    const profits = sortedMonths.map(month => monthTotals[month]);

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
        pdfDoc.text(`Date: KSh{report.date}`, 14, y);
        pdfDoc.text(`Generated: KSh{new Date().toLocaleString()}`, 14, y + 5);
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
                ? t.timestamp.toDate().toLocaleTimeString() : 'N/A',
            t.description,
            (t.income  ?? 0).toFixed(2),
            (t.expense ?? 0).toFixed(2),
            (t.profit  ?? 0).toFixed(2)
        ]);

        pdfDoc.autoTable({
            startY: pdfDoc.autoTable.previous.finalY + 15,
            head: [['Time', 'Description', 'Income (KSh)', 'Expense (KSh)', 'Profit (KSh)']],
            body: transactionBody,
            theme: 'striped', styles: { fontSize: 8 },
            headStyles: { fillColor: hexToRgbArr(branding.primaryColor) }
        });

        drawPdfFooter(pdfDoc, branding);
        pdfDoc.save(`Report_KSh{report.date}.pdf`);
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
        supplierPrice: parseFloat(document.getElementById('part-supplier-price').value),
        sellingPrice:  parseFloat(document.getElementById('part-selling-price').value),
        createdAt:     serverTimestamp()
    };
    if (part.sellingPrice < part.supplierPrice) {
        if (!confirm(`Warning: Selling Price (KShKSh{part.sellingPrice.toFixed(2)}) is less than Supplier Price (KShKSh{part.supplierPrice.toFixed(2)}). Continue?`)) return;
    }
    try {
        await addDoc(getPartsInventoryRef(), part);
        addPartForm.reset();
        alert('Part added successfully!');
    } catch (error) {
        alert('Failed to save part.');
        console.error('Part Save Error: ', error);
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

    partSaleProfitDisplay.textContent = `KShKSh{totalProfit.toFixed(2)}`;
    partSaleProfitDisplay.className   = totalProfit >= 0 ? 'font-bold text-xl text-green-600' : 'font-bold text-xl text-red-600';
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
    if (quantitySold > stock) return alert(`Cannot sell KSh{quantitySold}. Only KSh{stock} in stock.`);

    const supplierPrice = parseFloat(partOption.dataset.supplierPrice);
    const sellingPrice  = parseFloat(partOption.dataset.sellingPrice);
    const partName      = partOption.textContent.substring(0, partOption.textContent.indexOf(' (Stock'));
    const totalIncome   = sellingPrice  * quantitySold;
    const totalExpense  = supplierPrice * quantitySold;
    const totalProfit   = totalIncome - totalExpense;

    if (!confirm(`Confirm:\n  KSh{quantitySold} x KSh{partName}\n  Issued to: KSh{issuedTo}\n  Vehicle: KSh{carPlate}\n  Revenue: KShKSh{totalIncome.toFixed(2)}   Profit: KShKSh{totalProfit.toFixed(2)}`)) return;

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
                throw new Error(`Only KSh{liveStock} unit(s) left in stock. Another session may have just sold some.`);
            }

            transaction.update(partRef, { quantity: liveStock - quantitySold });

            transaction.set(transRef, {
                type: 'PART SALE', subtype: partName, plate: carPlate,
                description: `KSh{quantitySold} x KSh{partName} → KSh{issuedTo} (Plate: KSh{carPlate})`,
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

        alert(`Sale committed! KSh{quantitySold} x KSh{partName} issued to KSh{issuedTo}.\nProfit: KShKSh{totalProfit.toFixed(2)} recorded in Finance.`);
        sellPartForm.reset();
        partSaleProfitDisplay.textContent = 'KSh0.00';
    } catch (error) {
        alert(`Sale failed: KSh{error.message}`);
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

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50';
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">KSh{data.name} (KSh{data.sku || 'N/A'})</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm KSh{quantityClass}">KSh{data.quantity}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-red-600">KShKSh{(data.supplierPrice ?? 0).toFixed(2)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-green-600">KShKSh{(data.sellingPrice ?? 0).toFixed(2)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onclick="deletePart('KSh{docSnap.id}')" class="text-red-600 hover:text-red-900">Delete</button>
                </td>
            `;
            partsInventoryBody.appendChild(tr);

            if (data.quantity > 0) {
                const option = document.createElement('option');
                option.value = docSnap.id;
                option.textContent = `KSh{data.name} (Stock: KSh{data.quantity}, Profit/Unit: KShKSh{profitPerUnit.toFixed(2)})`;
                option.dataset.supplierPrice = data.supplierPrice;
                option.dataset.sellingPrice  = data.sellingPrice;
                option.dataset.stock         = data.quantity;
                partSaleSelect.appendChild(option);
            }
        });

        attachPartSaleListeners();
    }, error => console.error("Error listening to parts inventory: ", error));
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
            ? `<span class="font-mono font-bold text-blue-700">KSh{e.vehiclePlate}</span>`
            : `<span class="text-gray-400">—</span>`;
        const profitCls = (e.totalProfit ?? 0) >= 0 ? 'text-green-600' : 'text-red-600';
        return `
            <tr class="hover:bg-indigo-50 transition">
                <td class="px-4 py-3 whitespace-nowrap text-xs text-gray-500">KSh{dateStr}</td>
                <td class="px-4 py-3 text-sm font-medium text-gray-900">KSh{e.partName}</td>
                <td class="px-4 py-3 text-sm text-center font-bold text-gray-700">KSh{e.quantitySold}</td>
                <td class="px-4 py-3 text-sm font-semibold text-indigo-700">KSh{e.issuedTo || '—'}</td>
                <td class="px-4 py-3 text-sm">KSh{plateHtml}</td>
                <td class="px-4 py-3 text-sm text-gray-500">KSh{e.purpose || '—'}</td>
                <td class="px-4 py-3 text-sm font-semibold KSh{profitCls}">KShKSh{(e.totalIncome ?? 0).toFixed(2)}</td>
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
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">KSh{data.name}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">KSh{data.type}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">KSh{data.contact}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm KSh{data.owed > 0 ? 'text-red-600 font-bold' : 'text-green-600'}">KShKSh{(data.owed ?? 0).toFixed(2)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onclick="editSupplier('KSh{docSnap.id}')" class="text-indigo-600 hover:text-indigo-900 mr-2">Edit</button>
                    <button onclick="deleteSupplier('KSh{docSnap.id}')" class="text-red-600 hover:text-red-900">Delete</button>
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
    if (!supplier.contact) { alert(`Supplier contact not found for KSh{supplier.name}.`); return; }

    const cleanedContact = cleanPhoneNumber(supplier.contact);
    if (cleanedContact.length < 9) {
        alert(`The contact number for KSh{supplier.name} seems invalid: KSh{supplier.contact}`);
        return;
    }

    const message = `*Supply Request for KSh{supplier.name}*\n\n--- REQUIRED ITEMS ---\n\nKSh{suppliesText}\n\n--- END OF LIST ---\n\n*Garage Manager PRO*`;
    window.open(`https://wa.me/KSh{cleanedContact}?text=KSh{encodeURIComponent(message)}`, '_blank');
});

function editSupplier(id) { alert(`Editing supplier KSh{id}...`); }
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

function addInvoiceItemRow() {
    const container = document.getElementById('invoice-items-container');
    const row = document.createElement('div');
    row.className = 'flex space-x-2 item-row invoice-item-row mb-2';
    row.innerHTML = `
        <input type="text" placeholder="Description" class="invoice-item-desc form-input flex-grow">
        <input type="number" placeholder="Qty" value="1" min="1" class="invoice-item-qty form-input w-24" oninput="calculateTotal('invoice')">
        <input type="number" placeholder="Unit Price (KSh)" value="0.00" min="0" step="0.01" class="invoice-item-unit-price form-input w-36" oninput="calculateTotal('invoice')">
        <input type="text" placeholder="Total Amount (KSh)" value="0.00" class="invoice-item-amount form-input w-40 bg-gray-100" readonly>
        <button type="button" onclick="this.parentNode.remove(); calculateTotal('invoice');" class="delete-item-btn p-2 text-red-500 hover:text-red-700">X</button>
    `;
    container.appendChild(row);
    calculateTotal('invoice');
}

function calculateTotal(type) {
    const container = document.getElementById(`KSh{type}-items-container`);
    const itemRows  = container.querySelectorAll(`.KSh{type}-item-row`);
    let total = 0;
    itemRows.forEach(row => {
        const qty        = parseFloat(row.querySelector(`.KSh{type}-item-qty`).value) || 0;
        const unitPrice  = parseFloat(row.querySelector(`.KSh{type}-item-unit-price`).value) || 0;
        const itemAmount = qty * unitPrice;
        const lineTotal  = row.querySelector(`.KSh{type}-item-amount`);
        if (lineTotal) lineTotal.value = itemAmount.toFixed(2);
        total += itemAmount;
    });
    document.getElementById(`KSh{type}-total-display`).textContent = `KShKSh{total.toFixed(2)}`;
    return total;
}

invoiceCreationForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const totalAmount = calculateTotal('invoice');
    const items = [];

    document.querySelectorAll('#invoice-items-container .invoice-item-row').forEach(row => {
        const quantity  = parseFloat(row.querySelector('.invoice-item-qty').value) || 0;
        const unitPrice = parseFloat(row.querySelector('.invoice-item-unit-price').value) || 0;
        const lineTotal = quantity * unitPrice;
        if (lineTotal > 0) {
            items.push({ description: row.querySelector('.invoice-item-desc').value, quantity, unitPrice, amount: lineTotal });
        }
    });

    if (items.length === 0) {
        alert("Please add at least one item to the invoice with a total amount greater than zero.");
        return;
    }

    const invoice = {
        invoiceNo:   `INV-KSh{Date.now().toString().slice(-6)}`,
        clientName:  document.getElementById('invoice-client-name').value,
        clientPhone: document.getElementById('invoice-client-phone').value,
        carPlate:    document.getElementById('invoice-car-plate').value,
        items, total: totalAmount,
        date: getUTCDateString(), timestamp: serverTimestamp()
    };

    try {
        await addDoc(getInvoicesRef(), invoice);
        await addDoc(getDailyTransactionsRef(), {
            type: 'JOB', subtype: 'Invoice/Receipt', plate: invoice.carPlate,
            description: `Invoice #KSh{invoice.invoiceNo} paid by KSh{invoice.clientName}`,
            income: totalAmount, expense: 0, profit: totalAmount,
            timestamp: serverTimestamp(), isJob: true, date: getUTCDateString()
        });
        invoiceCreationForm.reset();
        document.getElementById('invoice-items-container').innerHTML = '';
        addInvoiceItemRow();
        alert('Invoice committed and amount reflected in Finance!');
    } catch (error) {
        alert('Failed to generate or commit invoice.');
        console.error('Invoice Creation Error: ', error);
    }
});

function listenForInvoices() {
    const q = query(getInvoicesRef(), orderBy('timestamp', 'desc'));
    onSnapshot(q, snapshot => {
        invoicesTableBody.innerHTML = '';
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50';
            tr.innerHTML = `
                <td class="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">KSh{data.invoiceNo}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500">KSh{data.date}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500">KSh{data.clientName} / KSh{data.carPlate}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-green-600 font-bold">KShKSh{(data.total ?? 0).toFixed(2)}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm">
                    <button onclick="generateInvoicePDF('KSh{docSnap.id}', 'KSh{data.clientPhone}')" class="text-blue-500 hover:text-blue-700 mr-2">PDF/Share</button>
                    <button onclick="deleteInvoice('KSh{docSnap.id}')" class="text-red-500 hover:text-red-700">Delete</button>
                </td>
            `;
            invoicesTableBody.appendChild(tr);
        });
    }, error => console.error("Error listening to invoices: ", error));
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

        const pdfDoc = new window.jspdf.jsPDF();
        let y = drawPdfHeader(pdfDoc, branding, "INVOICE / RECEIPT");

        pdfDoc.setFontSize(10); pdfDoc.setTextColor(60, 60, 60);
        pdfDoc.text(`Invoice No: KSh{invoice.invoiceNo}`, 14, y);
        pdfDoc.text(`Date: KSh{invoice.date}`, 110, y); y += 6;
        pdfDoc.text(`Client: KSh{invoice.clientName}`, 14, y);
        pdfDoc.text(`Phone: KSh{invoice.clientPhone}`, 110, y); y += 6;
        pdfDoc.text(`Vehicle Plate: KSh{invoice.carPlate}`, 14, y); y += 8;

        pdfDoc.autoTable({
            startY: y,
            head: [['Description', 'Qty', 'Unit Price (KSh)', 'Line Total (KSh)']],
            body: invoice.items.map(item => [
                item.description,
                (item.quantity ?? 0).toString(),
                `KShKSh{(item.unitPrice ?? 0).toFixed(2)}`,
                `KShKSh{(item.amount   ?? 0).toFixed(2)}`
            ]),
            foot: [['', '', 'Total', `KShKSh{(invoice.total ?? 0).toFixed(2)}`]],
            theme: 'grid', styles: { fontSize: 10 },
            headStyles: { fillColor: hexToRgbArr(branding.primaryColor) },
            footStyles: { fillColor: [230, 230, 255], textColor: [0, 0, 0], fontSize: 12, fontStyle: 'bold' }
        });

        drawPdfFooter(pdfDoc, branding);

        if (confirm('Share summary via WhatsApp?')) {
            const message = `*KSh{branding.garageName || 'Garage Manager PRO'} Invoice* (No. KSh{invoice.invoiceNo})\n\nDear KSh{invoice.clientName},\n\nYour invoice total: *KShKSh{(invoice.total ?? 0).toFixed(2)}*.\n\nThank you!`;
            window.open(`https://wa.me/KSh{cleanPhoneNumber(clientPhone)}?text=KSh{encodeURIComponent(message)}`, '_blank');
        }

        pdfDoc.save(`Invoice_KSh{invoice.invoiceNo}.pdf`);
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
        quoteNo:     `QUO-KSh{Date.now().toString().slice(-6)}`,
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
                <td class="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">KSh{data.quoteNo}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500">KSh{data.date}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500">KSh{data.clientName} / KSh{data.carPlate}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-indigo-600 font-bold">KShKSh{(data.total ?? 0).toFixed(2)} (Est.)</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm">
                    <button onclick="generateQuotePDF('KSh{docSnap.id}', 'KSh{data.clientPhone}')" class="text-blue-500 hover:text-blue-700 mr-2">PDF/Share</button>
                    <button onclick="deleteQuote('KSh{docSnap.id}')" class="text-red-500 hover:text-red-700">Delete</button>
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
        pdfDoc.text(`Quote No: KSh{quote.quoteNo}`, 14, y);
        pdfDoc.text(`Date: KSh{quote.date}`, 110, y); y += 6;
        pdfDoc.text(`Client: KSh{quote.clientName}`, 14, y);
        pdfDoc.text(`Phone: KSh{quote.clientPhone}`, 110, y); y += 6;
        pdfDoc.text(`Vehicle: KSh{quote.carMake}`, 14, y);
        pdfDoc.text(`Plate: KSh{quote.carPlate}`, 110, y); y += 8;

        pdfDoc.autoTable({
            startY: y,
            head: [['Item/Service', 'Qty', 'Est. Unit Cost (KSh)', 'Est. Line Total (KSh)']],
            body: quote.items.map(item => [
                item.description,
                (item.quantity ?? 0).toString(),
                `KShKSh{(item.unitPrice ?? 0).toFixed(2)}`,
                `KShKSh{(item.amount   ?? 0).toFixed(2)}`
            ]),
            foot: [['', '', 'Estimated Total', `KShKSh{(quote.total ?? 0).toFixed(2)}`]],
            theme: 'grid', styles: { fontSize: 10 },
            headStyles: { fillColor: hexToRgbArr(branding.primaryColor) },
            footStyles: { fillColor: [230, 230, 255], textColor: [0, 0, 0], fontSize: 12, fontStyle: 'bold' }
        });

        pdfDoc.setFontSize(9); pdfDoc.setTextColor(120, 120, 120);
        pdfDoc.text("NOTE: This is an estimate. Final costs may vary.", 14, pdfDoc.autoTable.previous.finalY + 8);

        drawPdfFooter(pdfDoc, branding);

        if (confirm('Share summary via WhatsApp?')) {
            const message = `*KSh{branding.garageName || 'Garage Manager PRO'} Repair Quote* (No. KSh{quote.quoteNo})\n\nDear KSh{quote.clientName},\n\nYour repair quote for the KSh{quote.carMake} is *KShKSh{(quote.total ?? 0).toFixed(2)}* (Estimated).\n\nPlease reply to confirm.`;
            window.open(`https://wa.me/KSh{cleanPhoneNumber(clientPhone)}?text=KSh{encodeURIComponent(message)}`, '_blank');
        }

        pdfDoc.save(`Quote_KSh{quote.quoteNo}.pdf`);
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
        const el = document.getElementById(`branding-KSh{f}`);
        if (!el) return;
        el.addEventListener('input', updateBrandingPreview);
    });

    ['primaryColor','secondaryColor','accentColor'].forEach(f => {
        const el = document.getElementById(`branding-KSh{f}`);
        if (!el) return;
        el.addEventListener('input', () => {
            const span = document.getElementById(`branding-KSh{f}-hex`);
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
    set('branding-preview-phone',       phone   ? `📞 KSh{phone}` : '');
    set('branding-preview-email',       email   ? `✉ KSh{email}`  : '');
    set('branding-preview-footer-left', `KSh{name}KSh{address ? '  |  ' + address : ''}`);

    const footerBar = document.getElementById('branding-footer-preview');
    if (footerBar) footerBar.style.background = primary;

    updateColorPreviews();
}

window.applyColorPreset = function(primary, secondary, accent) {
    const setColor = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
        const span = document.getElementById(`KSh{id}-hex`);
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
});

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
            const val = document.getElementById(`pin-KSh{role}`)?.value?.trim();
            if (val && val.length >= 4)      merged[role] = val;
            else if (val && val.length > 0) {
                msg.textContent = `❌ KSh{role} PIN must be at least 4 digits.`;
                msg.className = 'text-red-600 text-sm font-semibold mt-2';
                btn.disabled = false; btn.textContent = 'Save PINs';
                return;
            }
        }

        await updateDoc(doc(db, 'garages', garageCode), { pins: merged });
        msg.textContent = '✅ PINs saved successfully!';
        msg.className = 'text-green-600 text-sm font-semibold mt-2';
        ['mechanic','admin','manager'].forEach(role => {
            const el = document.getElementById(`pin-KSh{role}`);
            if (el) el.value = '';
        });
    } catch (err) {
        msg.textContent = `❌ Error: KSh{err.message}`;
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
    const content = document.getElementById(`payroll-subcontent-KSh{target}`);
    const btn     = document.getElementById(`subtab-KSh{target}`);
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
        msgEl.textContent = `❌ Error: KSh{err.message}`;
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
        const penaltyFlag = penalties > 0 ? `<span class="text-xs bg-orange-100 text-orange-700 font-bold px-2 py-0.5 rounded-full ml-1">⚠️ KShKSh{penalties.toFixed(2)} pending</span>` : '';
        return `
            <div class="border rounded-lg p-4 hover:shadow-md transition flex justify-between items-center cursor-pointer" onclick="openEmployeeModal('KSh{emp.id}')">
                <div>
                    <p class="font-bold text-gray-800">KSh{escapeHtmlPR(emp.name)} KSh{penaltyFlag}</p>
                    <p class="text-sm text-indigo-600">KSh{escapeHtmlPR(emp.position)}</p>
                    <p class="text-xs text-gray-400">KSh{emp.payFrequency || 'Monthly'} · Base: KShKSh{(emp.baseSalary || 0).toFixed(2)}</p>
                </div>
                <div class="text-right">
                    <span class="text-xs font-semibold px-2 py-1 rounded-full KSh{statusColors[emp.status] || 'bg-gray-100 text-gray-600'}">KSh{emp.status || 'Active'}</span>
                    <p class="text-sm font-bold text-gray-700 mt-1">Net: KShKSh{net.toFixed(2)}</p>
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
    document.getElementById('epm-emp-position').textContent = `KSh{emp.position} · KSh{emp.payFrequency || 'Monthly'} · KSh{emp.status || 'Active'}`;
    document.getElementById('epm-base-salary').value = emp.baseSalary || 0;

    const lineItemRow = (item, idx, type, colorCls) => `
        <div class="flex justify-between items-center bg-white border rounded-lg px-3 py-2">
            <span class="text-sm text-gray-700">KSh{escapeHtmlPR(item.label)}</span>
            <div class="flex items-center gap-2">
                <span class="text-sm font-semibold KSh{colorCls}">KShKSh{(parseFloat(item.amount) || 0).toFixed(2)}</span>
                <button onclick="removeEmployeeLineItem('KSh{type}', KSh{idx})" class="text-gray-400 hover:text-red-500 text-xs font-bold">✕</button>
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
    document.getElementById('epm-calc-base').textContent       = `KShKSh{(emp.baseSalary || 0).toFixed(2)}`;
    document.getElementById('epm-calc-benefits').textContent   = `KShKSh{benefits.toFixed(2)}`;
    document.getElementById('epm-calc-deductions').textContent = `KShKSh{deductions.toFixed(2)}`;
    document.getElementById('epm-calc-penalties').textContent  = `KShKSh{penalties.toFixed(2)}`;
    const netEl = document.getElementById('epm-calc-net');
    netEl.textContent = `KShKSh{net.toFixed(2)}`;
    netEl.className = net >= 0 ? 'text-green-700' : 'text-red-600';
}

window.updateEmployeeBaseSalary = async function () {
    if (!_currentEmployeeId) return;
    const newBase = parseFloat(document.getElementById('epm-base-salary').value) || 0;
    try {
        await updateDoc(garageDoc(db, doc, 'employees', _currentEmployeeId), { baseSalary: newBase });
    } catch (err) {
        alert(`Failed to update base salary: KSh{err.message}`);
    }
};

window.addEmployeeLineItem = async function (type) {
    if (!_currentEmployeeId) return;
    const labelInput  = document.getElementById(`epm-new-KSh{type === 'deductions' ? 'deduction' : type === 'benefits' ? 'benefit' : 'penalty'}-label`);
    const amountInput = document.getElementById(`epm-new-KSh{type === 'deductions' ? 'deduction' : type === 'benefits' ? 'benefit' : 'penalty'}-amount`);
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
        alert(`Failed to add KSh{type.slice(0, -1)}: KSh{err.message}`);
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
        alert(`Failed to remove item: KSh{err.message}`);
    }
};

window.deleteEmployee = async function () {
    if (!_currentEmployeeId) return;
    const emp = allEmployees.find(e => e.id === _currentEmployeeId);
    if (!emp) return;
    if (!confirm(`Remove KSh{emp.name} from payroll? Past payment history will be kept for records.`)) return;
    try {
        await deleteDoc(garageDoc(db, doc, 'employees', _currentEmployeeId));
        closeEmployeeModal();
    } catch (err) {
        alert(`Failed to remove employee: KSh{err.message}`);
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

    if (!confirm(`Pay KSh{emp.name} a net amount of KShKSh{net.toFixed(2)}?\n\nThis records the payment in today's Finance expenses and clears pending penalties for this run.`)) return;

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
                description: `Salary paid to KSh{liveEmp.name} (KSh{liveEmp.position})`,
                income: 0, expense: net, profit: -net,
                timestamp: serverTimestamp(), isJob: false, date: getUTCDateString()
            });

            // Clear pending penalties (they've now been deducted) — base/benefits/deductions persist for next run
            transaction.update(empRef, { penalties: [] });
        });

        msgEl.textContent = `✅ Paid KShKSh{net.toFixed(2)} to KSh{emp.name}. Recorded in Finance.`;
        msgEl.className = 'text-sm mt-2 text-center text-green-600 font-semibold';
    } catch (err) {
        msgEl.textContent = `❌ KSh{err.message}`;
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
                <span class="text-gray-500">KSh{dateStr}</span>
                <span class="font-bold text-indigo-700">KShKSh{(r.netPay || 0).toFixed(2)}</span>
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
        msgEl.textContent = `❌ Error: KSh{err.message}`;
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
        allCasualWorkers.map(w => `<option value="KSh{w.id}">KSh{escapeHtmlPR(w.name)} (KSh{w.workerType || 'Casual'})</option>`).join('');
    if (current) sel.value = current;
}

function populateCasualLedgerFilter() {
    const sel = document.getElementById('casual-ledger-filter');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="all">All Workers</option>' +
        allCasualWorkers.map(w => `<option value="KSh{w.id}">KSh{escapeHtmlPR(w.name)}</option>`).join('');
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
        msgEl.textContent = `✅ KShKSh{amount.toFixed(2)} logged as due for KSh{worker.name}.`;
        msgEl.className = 'text-green-600 text-sm';
        logCasualEarningForm.reset();
        document.getElementById('casual-earning-date').value = getUTCDateString();
    } catch (err) {
        msgEl.textContent = `❌ Error: KSh{err.message}`;
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
                    <p class="font-semibold text-gray-800">KSh{escapeHtmlPR(w.name)} <span class="text-xs text-gray-400 ml-1">(KSh{w.workerType || 'Casual'})</span></p>
                    <p class="text-xs text-gray-500">KSh{escapeHtmlPR(w.role || 'General Labor')}KSh{w.phone ? ' · ' + escapeHtmlPR(w.phone) : ''}</p>
                </div>
                <div class="text-right flex items-center gap-3">
                    <div>
                        <p class="text-xs text-gray-400">Outstanding Due</p>
                        <p class="KSh{dueCls}">KShKSh{due.toFixed(2)}</p>
                    </div>
                    KSh{due > 0 ? `<button onclick="payAllDuesForWorker('KSh{w.id}')" class="bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg">Pay All Due</button>` : ''}
                    <button onclick="deleteCasualWorker('KSh{w.id}','KSh{escapeHtmlPR(w.name)}')" class="text-red-400 hover:text-red-600 text-xs">Remove</button>
                </div>
            </div>`;
    }).join('');
}

window.deleteCasualWorker = async function (workerId, workerName) {
    const due = outstandingDuesFor(workerId);
    if (due > 0) {
        alert(`Cannot remove KSh{workerName} — they have KShKSh{due.toFixed(2)} in outstanding dues. Settle their payment first.`);
        return;
    }
    if (!confirm(`Remove KSh{workerName} from registered workers? Earnings history will be kept.`)) return;
    try {
        await deleteDoc(garageDoc(db, doc, 'casualWorkers', workerId));
    } catch (err) {
        alert(`Failed to remove worker: KSh{err.message}`);
    }
};

// ── Pay a single earning entry ─────────────────────────────────────
window.markCasualEarningPaid = async function (earningId) {
    if (!can('viewFinancials')) { alert('Only managers can record payments.'); return; }
    const entry = allCasualEarnings.find(e => e.id === earningId);
    if (!entry || entry.paid) return;
    if (!confirm(`Pay KSh{entry.workerName} KShKSh{entry.amount.toFixed(2)} for: KSh{entry.description || 'logged work'}?`)) return;

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
                description: `Paid KSh{entry.workerName}: KSh{entry.description || 'casual labor'} (Plate: KSh{entry.plate || 'N/A'})`,
                income: 0, expense: entry.amount, profit: -entry.amount,
                timestamp: serverTimestamp(), isJob: false, date: getUTCDateString()
            });
        });
    } catch (err) {
        alert(`Payment failed: KSh{err.message}`);
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
    if (!confirm(`Pay KSh{worker.name} a total of KShKSh{total.toFixed(2)} across KSh{dueEntries.length} due entrKSh{dueEntries.length === 1 ? 'y' : 'ies'}?`)) return;

    try {
        const batch = writeBatch(db);
        dueEntries.forEach(entry => {
            batch.update(garageDoc(db, doc, 'casualEarnings', entry.id), { paid: true, paidAt: serverTimestamp() });
        });
        batch.set(doc(getDailyTransactionsRef()), {
            type: 'CASUAL LABOR', subtype: 'Casual/Per-Job Bulk Payment', plate: 'N/A',
            description: `Settled KSh{dueEntries.length} due payment(s) for KSh{worker.name}`,
            income: 0, expense: total, profit: -total,
            timestamp: serverTimestamp(), isJob: false, date: getUTCDateString()
        });
        await batch.commit();
        alert(`✅ Paid KShKSh{total.toFixed(2)} to KSh{worker.name}.`);
    } catch (err) {
        alert(`Bulk payment failed: KSh{err.message}`);
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
        alert(`Failed to delete entry: KSh{err.message}`);
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
                 <button onclick="markCasualEarningPaid('KSh{e.id}')" class="text-green-600 hover:text-green-800 text-xs font-bold">Pay</button>
                 <button onclick="deleteCasualEarning('KSh{e.id}')" class="text-red-400 hover:text-red-600 text-xs">Delete</button>
               </div>`;
        return `
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 whitespace-nowrap text-xs text-gray-500">KSh{e.date || 'N/A'}</td>
                <td class="px-4 py-3 text-sm font-medium text-gray-900">KSh{escapeHtmlPR(e.workerName)}</td>
                <td class="px-4 py-3 text-sm text-gray-500">KSh{escapeHtmlPR(e.description) || '—'}</td>
                <td class="px-4 py-3 text-sm font-mono">KSh{e.plate && e.plate !== 'N/A' ? escapeHtmlPR(e.plate) : '—'}</td>
                <td class="px-4 py-3 text-sm font-semibold text-gray-800">KShKSh{(e.amount || 0).toFixed(2)}</td>
                <td class="px-4 py-3 text-sm">KSh{statusBadge}</td>
                <td class="px-4 py-3 text-sm">KSh{actionBtn}</td>
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
    if (elPayroll) elPayroll.textContent = `KShKSh{totalPayroll.toFixed(2)}`;
    if (elCasual)  elCasual.textContent  = `KShKSh{totalCasualPaid.toFixed(2)}`;
    if (elOutstanding) elOutstanding.textContent = `KShKSh{totalOutstanding.toFixed(2)}`;

    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-gray-400">No payments recorded yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map(r => `
        <tr class="hover:bg-gray-50">
            <td class="px-4 py-3 whitespace-nowrap text-xs text-gray-500">KSh{r.date}</td>
            <td class="px-4 py-3 text-sm font-medium text-gray-900">KSh{escapeHtmlPR(r.name)}</td>
            <td class="px-4 py-3 text-sm"><span class="text-xs font-bold px-2 py-1 rounded-full KSh{r.typeColor}">KSh{r.type}</span></td>
            <td class="px-4 py-3 text-sm text-gray-500">KSh{escapeHtmlPR(r.details) || '—'}</td>
            <td class="px-4 py-3 text-sm font-semibold text-gray-800">KShKSh{r.amount.toFixed(2)}</td>
        </tr>`).join('');
}
window.renderPayHistory = renderPayHistory;
