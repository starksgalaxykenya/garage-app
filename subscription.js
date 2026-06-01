// =================================================================
// FILE: subscription.js
// Description: Subscription gate for Garage Manager PRO SaaS
// Flow: Login → Check Subscription → Active/FreeTrial → Access
//                                  → Inactive → Payment Page
//
// NOTE: Uses Firebase Modular SDK v9+ (imported via index.html's
//       type="module" script). Receives `db` as a Firestore instance
//       obtained from getFirestore(), and uses doc/getDoc functions
//       imported from firebase-firestore.js.
// =================================================================

const PAYMENT_PAGE_URL = 'payment.html';
const FREE_TRIAL_DAYS = 14;

/**
 * Called on login AND once per day (via daily interval check).
 * Returns the subscription status object or redirects as needed.
 *
 * @param {string} garageCode       - The garage code (LLL-NNNNN format)
 * @param {object} db               - Firestore db instance (from getFirestore())
 * @param {function} onAccessGranted - Callback when access is allowed
 */
async function checkSubscription(garageCode, db, docFn, getDocFn, onAccessGranted) {
    // 1. Validate garage code format: LLL-NNNNN
    const codeRegex = /^[A-Za-z]{3}-\d{5}$/;
    if (!codeRegex.test(garageCode)) {
        showSubscriptionError('Invalid garage code format. Expected format: ABC-12345');
        return;
    }

    try {
        // ✅ Modular v9+ SDK: use doc() + getDoc() instead of .collection().doc().get()
        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js");

        const garageRef = doc(db, 'garages', garageCode.toUpperCase());
        const snap = await getDoc(garageRef);

        if (!snap.exists()) {
            showSubscriptionError('Garage code not found. Please contact your administrator.');
            return;
        }

        const data = snap.data();
        const status = (data.subscriptionStatus || '').toLowerCase();

        if (status === 'active') {
            // ✅ Active → grant access
            storeSessionGarage(garageCode, 'active');
            onAccessGranted(data);

        } else if (status === 'trial') {
            // ✅ Free Trial → check if still within trial period
            const trialStart = data.trialStartDate ? new Date(data.trialStartDate) : new Date();
            const now = new Date();
            const daysDiff = Math.floor((now - trialStart) / (1000 * 60 * 60 * 24));

            if (daysDiff <= FREE_TRIAL_DAYS) {
                const daysLeft = FREE_TRIAL_DAYS - daysDiff;
                storeSessionGarage(garageCode, 'trial');
                showTrialBanner(daysLeft);
                onAccessGranted(data);
            } else {
                // Trial expired — treat as inactive
                redirectToPayment(garageCode, 'Your free trial has expired.');
            }

        } else if (status === 'inactive') {
            // ❌ Inactive → Payment Page
            redirectToPayment(garageCode, 'Your subscription is inactive.');

        } else {
            showSubscriptionError('Unknown subscription status. Contact support.');
        }

    } catch (err) {
        console.error('Subscription check error:', err);
        showSubscriptionError('Could not verify subscription. Check your connection.');
    }
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

/**
 * Sets up a daily interval check (runs every hour, catches day rollover).
 * If the date has changed since last check, re-validates subscription.
 */
function setupDailySubscriptionCheck(garageCode, db, docFn, getDocFn, onAccessGranted) {
    const INTERVAL_MS = 60 * 60 * 1000;
    setInterval(() => {
        const lastChecked = sessionStorage.getItem('lastChecked');
        const today = new Date().toDateString();
        if (lastChecked !== today) {
            console.log('[Subscription] Day changed — re-checking subscription...');
            checkSubscription(garageCode, db, onAccessGranted);
        }
    }, INTERVAL_MS);
}

// Expose globally (loaded as a classic script from index.html's <head>)
window.checkSubscription = checkSubscription;
window.setupDailySubscriptionCheck = setupDailySubscriptionCheck;
window.storeSessionGarage = storeSessionGarage;
