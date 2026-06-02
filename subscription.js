// =================================================================
// FILE: subscription.js
// Description: Subscription gate for Garage Manager PRO SaaS
// Flow: Login → Check Subscription → Active/FreeTrial → Access
//                                  → Inactive → Payment Page
//
// IMPORTANT: This file is loaded as a classic <script> (no type="module").
// It must NOT import Firebase itself. Instead, callers pass in the
// already-initialised `db`, `doc`, and `getDoc` from their own module.
//
// Usage from index.html / management.js (inside type="module" script):
//
//   import { getFirestore, doc, getDoc } from "...firebase-firestore.js";
//   const db = getFirestore(app);
//   checkSubscription(garageCode, db, doc, getDoc, onAccessGranted);
//   setupDailySubscriptionCheck(garageCode, db, doc, getDoc, onAccessGranted);
// =================================================================

const PAYMENT_PAGE_URL = 'payment.html';
const FREE_TRIAL_DAYS = 14;

/**
 * @param {string}   garageCode       - e.g. "ABC-12345"
 * @param {object}   db               - Firestore instance from getFirestore()
 * @param {function} docFn            - The `doc` function from firebase-firestore
 * @param {function} getDocFn         - The `getDoc` function from firebase-firestore
 * @param {function} onAccessGranted  - Callback(garageData) on success
 */
async function checkSubscription(garageCode, db, docFn, getDocFn, onAccessGranted) {
    const codeRegex = /^[A-Za-z]{3}-\d{5}$/;
    if (!codeRegex.test(garageCode)) {
        showSubscriptionError('Invalid garage code format. Expected format: ABC-12345');
        return;
    }

    try {
        const garageRef = docFn(db, 'garages', garageCode.toUpperCase());
        const snap = await getDocFn(garageRef);

        if (!snap.exists()) {
            showSubscriptionError('Garage code not found. Please contact your administrator.');
            return;
        }

        const data = snap.data();
        const status = (data.subscriptionStatus || '').toLowerCase();

        if (status === 'active') {
            storeSessionGarage(garageCode, 'active');
            onAccessGranted(data);

        } else if (status === 'trial') {
            const trialStart = data.trialStartDate ? new Date(data.trialStartDate) : new Date();
            const now = new Date();
            const daysDiff = Math.floor((now - trialStart) / (1000 * 60 * 60 * 24));

            if (daysDiff <= FREE_TRIAL_DAYS) {
                const daysLeft = FREE_TRIAL_DAYS - daysDiff;
                storeSessionGarage(garageCode, 'trial');
                showTrialBanner(daysLeft);
                onAccessGranted(data);
            } else {
                redirectToPayment(garageCode, 'Your free trial has expired.');
            }

        } else if (status === 'inactive') {
            redirectToPayment(garageCode, 'Your subscription is inactive.');

        } else {
            showSubscriptionError('Unknown subscription status. Contact support.');
        }

    } catch (err) {
        console.error('Subscription check error:', err);
        showSubscriptionError('Could not verify subscription. Check your connection.');
    }
}

/**
 * @param {string}   garageCode
 * @param {object}   db
 * @param {function} docFn
 * @param {function} getDocFn
 * @param {function} onAccessGranted
 */
function setupDailySubscriptionCheck(garageCode, db, docFn, getDocFn, onAccessGranted) {
    const INTERVAL_MS = 60 * 60 * 1000; // hourly — catches day rollover
    setInterval(() => {
        const lastChecked = sessionStorage.getItem('lastChecked');
        const today = new Date().toDateString();
        if (lastChecked !== today) {
            console.log('[Subscription] Day changed — re-checking subscription...');
            checkSubscription(garageCode, db, docFn, getDocFn, onAccessGranted);
        }
    }, INTERVAL_MS);
}

function storeSessionGarage(code, status) {
    sessionStorage.setItem('garageCode', code.toUpperCase());
    sessionStorage.setItem('subscriptionStatus', status);
    sessionStorage.setItem('lastChecked', new Date().toDateString());
}

function redirectToPayment(code, reason) {
    alert(`Access Denied: ${reason}`);
    window.location.href = `${PAYMENT_PAGE_URL}?code=${encodeURIComponent(code)}&reason=${encodeURIComponent(reason)}`;
}

function showSubscriptionError(msg) {
    const el = document.getElementById('garage-code-message');
    if (el) el.textContent = msg;
    else alert(msg);
}

function showTrialBanner(daysLeft) {
    if (document.getElementById('trial-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'trial-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#f59e0b;color:#1f2937;text-align:center;padding:8px;font-weight:bold;font-size:14px;';
    banner.textContent = `⚠️ FREE TRIAL: ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining. Upgrade to keep access.`;
    document.body.prepend(banner);
}

// Expose globally
window.checkSubscription          = checkSubscription;
window.setupDailySubscriptionCheck = setupDailySubscriptionCheck;
window.storeSessionGarage         = storeSessionGarage;
