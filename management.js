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
    garageCol
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

    if (result.firstSetup) {
        msg.textContent = '';
        alert('Welcome! Default manager PIN is 0000. Please set your PINs in Settings immediately.');
    }

    setSession(garageCode, role);
    if (result.garageData) showTrialBanner(result.garageData);
    grantManagementAccess(role);
}
window.enterPinAndLogin = enterPinAndLogin;

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

    // PIN management tab/section visible to manager only
    const pinSection = document.getElementById('pin-management-section');
    if (pinSection) pinSection.style.display = can('managePins') ? '' : 'none';

    listenForDailyTransactions();
    listenForSuppliers();
    listenForPartsInventory();
    listenForInvoices();
    listenForQuotes();

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
function bootManagement() {
    const { garageCode, role, authed } = getSession();
    if (authed && garageCode && (role === 'manager' || role === 'admin')) {
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
        jobProfitDisplay.textContent = `Profit: $${profit.toFixed(2)}`;
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
        jobProfitDisplay.textContent = 'Profit: $0.00';
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
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500">${displayTime}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900">${escapeHtml(data.subtype || 'Other')}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500">${escapeHtml(data.plate || 'N/A')}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-green-600">$${safeToFixed(safeIncome)}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-red-600">$${safeToFixed(safeExpense)}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm ${profitClass}">$${safeToFixed(profit)}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm">
                    <button onclick="deleteTransaction('${docSnap.id}')" class="text-red-500 hover:text-red-700">Delete</button>
                </td>
            `;
            dailyTransactionsBody.appendChild(tr);
        });

        const netProfit = totalIncome - totalExpense;
        summaryIncome.textContent  = `$${safeToFixed(totalIncome)}`;
        summaryExpense.textContent = `$${safeToFixed(totalExpense)}`;
        summaryProfit.textContent  = `$${safeToFixed(netProfit)}`;
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

        alert(`Day closed! Net profit: $${(parseFloat(summaryProfit.textContent.replace('$','')) || 0).toFixed(2)}`);
    } catch (err) {
        alert(`Could not save report: ${err.message}`);
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
                <span class="font-medium">${data.date}</span>
                <span class="${data.netProfit >= 0 ? 'text-green-600' : 'text-red-600'} font-bold">$${(data.netProfit ?? 0).toFixed(2)}</span>
                <button onclick="generateDailyReportPDF('${docSnap.id}')" class="text-blue-500 hover:text-blue-700 text-sm">Print/View</button>
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
                label: 'Monthly Net Profit ($)',
                data: profits,
                backgroundColor: profits.map(p => p >= 0 ? 'rgba(52, 211, 153, 0.7)' : 'rgba(239, 68, 68, 0.7)'),
                borderColor:     profits.map(p => p >= 0 ? 'rgba(52, 211, 153, 1)'   : 'rgba(239, 68, 68, 1)'),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true, title: { display: true, text: 'Profit/Loss ($)' } } }
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
            head: [['Metric', 'Amount ($)']],
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
            head: [['Time', 'Description', 'Income ($)', 'Expense ($)', 'Profit ($)']],
            body: transactionBody,
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
        supplierPrice: parseFloat(document.getElementById('part-supplier-price').value),
        sellingPrice:  parseFloat(document.getElementById('part-selling-price').value),
        createdAt:     serverTimestamp()
    };
    if (part.sellingPrice < part.supplierPrice) {
        if (!confirm(`Warning: Selling Price ($${part.sellingPrice.toFixed(2)}) is less than Supplier Price ($${part.supplierPrice.toFixed(2)}). Continue?`)) return;
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
    partSaleProfitDisplay.textContent = '$0.00';
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

    partSaleProfitDisplay.textContent = `$${totalProfit.toFixed(2)}`;
    partSaleProfitDisplay.className   = totalProfit >= 0 ? 'font-bold text-xl text-green-600' : 'font-bold text-xl text-red-600';
    commitPartSaleBtn.disabled = false;
}

sellPartForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const partId       = partSaleSelect.value;
    const partOption   = partSaleSelect.options[partSaleSelect.selectedIndex];
    const quantitySold = parseInt(partSaleQuantityInput.value);
    const carPlate     = document.getElementById('part-sale-plate').value || 'N/A';

    if (!partId || quantitySold <= 0) return alert("Please select a part and specify quantity.");

    const stock = parseInt(partOption.dataset.stock);
    if (quantitySold > stock) return alert(`Cannot sell ${quantitySold}. Only ${stock} in stock.`);

    const supplierPrice = parseFloat(partOption.dataset.supplierPrice);
    const sellingPrice  = parseFloat(partOption.dataset.sellingPrice);
    const partName      = partOption.textContent.substring(0, partOption.textContent.indexOf(' (Stock'));
    const totalIncome   = sellingPrice  * quantitySold;
    const totalExpense  = supplierPrice * quantitySold;
    const totalProfit   = totalIncome - totalExpense;

    if (!confirm(`Confirm sale of ${quantitySold} x ${partName} for $${totalIncome.toFixed(2)} (Profit: $${totalProfit.toFixed(2)})?`)) return;

    commitPartSaleBtn.disabled = true;
    try {
        const partRef    = garageDoc(db, doc, 'partsInventory', partId);
        const transRef   = doc(getDailyTransactionsRef());

        await runTransaction(db, async (transaction) => {
            // Read live stock from Firestore — not the UI cache
            const partSnap = await transaction.get(partRef);
            if (!partSnap.exists()) throw new Error('Part no longer exists.');

            const liveStock = partSnap.data().quantity ?? 0;
            if (quantitySold > liveStock) {
                throw new Error(`Only ${liveStock} unit(s) left in stock. Another session may have just sold some.`);
            }

            transaction.update(partRef, { quantity: liveStock - quantitySold });
            transaction.set(transRef, {
                type: 'PART SALE', subtype: partName, plate: carPlate,
                description: `${quantitySold} x ${partName} sold (Plate: ${carPlate})`,
                income: totalIncome, expense: totalExpense, profit: totalProfit,
                timestamp: serverTimestamp(), isJob: true, date: getUTCDateString()
            });
        });

        alert(`Sale committed! Profit: $${totalProfit.toFixed(2)} recorded in Finance.`);
        sellPartForm.reset();
        partSaleProfitDisplay.textContent = '$0.00';
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

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50';
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${data.name} (${data.sku || 'N/A'})</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm ${quantityClass}">${data.quantity}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-red-600">$${(data.supplierPrice ?? 0).toFixed(2)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-green-600">$${(data.sellingPrice ?? 0).toFixed(2)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onclick="deletePart('${docSnap.id}')" class="text-red-600 hover:text-red-900">Delete</button>
                </td>
            `;
            partsInventoryBody.appendChild(tr);

            if (data.quantity > 0) {
                const option = document.createElement('option');
                option.value = docSnap.id;
                option.textContent = `${data.name} (Stock: ${data.quantity}, Profit/Unit: $${profitPerUnit.toFixed(2)})`;
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
                <td class="px-6 py-4 whitespace-nowrap text-sm ${data.owed > 0 ? 'text-red-600 font-bold' : 'text-green-600'}">$${(data.owed ?? 0).toFixed(2)}</td>
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

function addInvoiceItemRow() {
    const container = document.getElementById('invoice-items-container');
    const row = document.createElement('div');
    row.className = 'flex space-x-2 item-row invoice-item-row mb-2';
    row.innerHTML = `
        <input type="text" placeholder="Description" class="invoice-item-desc form-input flex-grow">
        <input type="number" placeholder="Qty" value="1" min="1" class="invoice-item-qty form-input w-24" oninput="calculateTotal('invoice')">
        <input type="number" placeholder="Unit Price ($)" value="0.00" min="0" step="0.01" class="invoice-item-unit-price form-input w-36" oninput="calculateTotal('invoice')">
        <input type="text" placeholder="Total Amount ($)" value="0.00" class="invoice-item-amount form-input w-40 bg-gray-100" readonly>
        <button type="button" onclick="this.parentNode.remove(); calculateTotal('invoice');" class="delete-item-btn p-2 text-red-500 hover:text-red-700">X</button>
    `;
    container.appendChild(row);
    calculateTotal('invoice');
}

function calculateTotal(type) {
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
    document.getElementById(`${type}-total-display`).textContent = `$${total.toFixed(2)}`;
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
        invoiceNo:   `INV-${Date.now().toString().slice(-6)}`,
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
            description: `Invoice #${invoice.invoiceNo} paid by ${invoice.clientName}`,
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
                <td class="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">${data.invoiceNo}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500">${data.date}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500">${data.clientName} / ${data.carPlate}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-green-600 font-bold">$${(data.total ?? 0).toFixed(2)}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm">
                    <button onclick="generateInvoicePDF('${docSnap.id}', '${data.clientPhone}')" class="text-blue-500 hover:text-blue-700 mr-2">PDF/Share</button>
                    <button onclick="deleteInvoice('${docSnap.id}')" class="text-red-500 hover:text-red-700">Delete</button>
                </td>
            `;
            invoicesTableBody.appendChild(tr);
        });
    }, error => console.error("Error listening to invoices: ", error));
}

async function generateInvoicePDF(invoiceId, clientPhone) {
    try {
        const docSnap = await getDoc(garageDoc(db, doc, 'invoices', invoiceId));
        if (!docSnap.exists()) { alert("Invoice not found."); return; }
        const invoice  = docSnap.data();
        const branding = await getBranding();

        const pdfDoc = new window.jspdf.jsPDF();
        let y = drawPdfHeader(pdfDoc, branding, "INVOICE / RECEIPT");

        pdfDoc.setFontSize(10); pdfDoc.setTextColor(60, 60, 60);
        pdfDoc.text(`Invoice No: ${invoice.invoiceNo}`, 14, y);
        pdfDoc.text(`Date: ${invoice.date}`, 110, y); y += 6;
        pdfDoc.text(`Client: ${invoice.clientName}`, 14, y);
        pdfDoc.text(`Phone: ${invoice.clientPhone}`, 110, y); y += 6;
        pdfDoc.text(`Vehicle Plate: ${invoice.carPlate}`, 14, y); y += 8;

        pdfDoc.autoTable({
            startY: y,
            head: [['Description', 'Qty', 'Unit Price ($)', 'Line Total ($)']],
            body: invoice.items.map(item => [
                item.description,
                (item.quantity ?? 0).toString(),
                `$${(item.unitPrice ?? 0).toFixed(2)}`,
                `$${(item.amount   ?? 0).toFixed(2)}`
            ]),
            foot: [['', '', 'Total', `$${(invoice.total ?? 0).toFixed(2)}`]],
            theme: 'grid', styles: { fontSize: 10 },
            headStyles: { fillColor: hexToRgbArr(branding.primaryColor) },
            footStyles: { fillColor: [230, 230, 255], textColor: [0, 0, 0], fontSize: 12, fontStyle: 'bold' }
        });

        drawPdfFooter(pdfDoc, branding);

        if (confirm('Share summary via WhatsApp?')) {
            const message = `*${branding.garageName || 'Garage Manager PRO'} Invoice* (No. ${invoice.invoiceNo})\n\nDear ${invoice.clientName},\n\nYour invoice total: *$${(invoice.total ?? 0).toFixed(2)}*.\n\nThank you!`;
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
// 8. REPAIR QUOTES LOGIC
// =================================================================

function addQuoteItemRow() {
    const container = document.getElementById('quote-items-container');
    const row = document.createElement('div');
    row.className = 'flex space-x-2 item-row quote-item-row mb-2';
    row.innerHTML = `
        <input type="text" placeholder="Description" class="quote-item-desc form-input flex-grow">
        <input type="number" placeholder="Qty" value="1" min="1" class="quote-item-qty form-input w-24" oninput="calculateTotal('quote')">
        <input type="number" placeholder="Unit Price ($)" value="0.00" min="0" step="0.01" class="quote-item-unit-price form-input w-36" oninput="calculateTotal('quote')">
        <input type="text" placeholder="Total Amount ($)" value="0.00" class="quote-item-amount form-input w-40 bg-gray-100" readonly>
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
                <td class="px-3 py-2 whitespace-nowrap text-sm text-indigo-600 font-bold">$${(data.total ?? 0).toFixed(2)} (Est.)</td>
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
            head: [['Item/Service', 'Qty', 'Est. Unit Cost ($)', 'Est. Line Total ($)']],
            body: quote.items.map(item => [
                item.description,
                (item.quantity ?? 0).toString(),
                `$${(item.unitPrice ?? 0).toFixed(2)}`,
                `$${(item.amount   ?? 0).toFixed(2)}`
            ]),
            foot: [['', '', 'Estimated Total', `$${(quote.total ?? 0).toFixed(2)}`]],
            theme: 'grid', styles: { fontSize: 10 },
            headStyles: { fillColor: hexToRgbArr(branding.primaryColor) },
            footStyles: { fillColor: [230, 230, 255], textColor: [0, 0, 0], fontSize: 12, fontStyle: 'bold' }
        });

        pdfDoc.setFontSize(9); pdfDoc.setTextColor(120, 120, 120);
        pdfDoc.text("NOTE: This is an estimate. Final costs may vary.", 14, pdfDoc.autoTable.previous.finalY + 8);

        drawPdfFooter(pdfDoc, branding);

        if (confirm('Share summary via WhatsApp?')) {
            const message = `*${branding.garageName || 'Garage Manager PRO'} Repair Quote* (No. ${quote.quoteNo})\n\nDear ${quote.clientName},\n\nYour repair quote for the ${quote.carMake} is *$${(quote.total ?? 0).toFixed(2)}* (Estimated).\n\nPlease reply to confirm.`;
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

// =================================================================
// 9. INITIALIZATION
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('invoice-items-container')) addInvoiceItemRow();
    if (document.getElementById('quote-items-container'))   addQuoteItemRow();
});

window.addInvoiceItemRow = addInvoiceItemRow;
window.addQuoteItemRow   = addQuoteItemRow;
window.calculateTotal    = calculateTotal;

// =================================================================
// 10. BRANDING TAB INITIALIZATION & LIVE PREVIEW
// =================================================================

function hexToRgbArr(hex) {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#1d4ed8');
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
    const brandingTabBtn = document.getElementById('tab-branding');
    if (brandingTabBtn) {
        brandingTabBtn.addEventListener('click', setupBrandingTab);
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
