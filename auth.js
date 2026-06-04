// =================================================================
// FILE: auth.js
// Description: PIN-based authentication for Garage Manager PRO.
//   Replaces email/password with a 4-digit PIN per role.
//
// ROLES:
//   mechanic  – Read-only garage bay view (job cards, active/completed jobs).
//               Cannot create entries, access financials, or change settings.
//   admin     – Full garage app access. Cannot manage PINs.
//   manager   – Full access including financials + PIN management.
//
// FLOW:
//   1. Enter Garage Code  → validated against Firestore 'garages' collection
//   2. Select Role        → Mechanic / Admin / Manager
//   3. Enter PIN          → checked against garages/{code}.pins.{role}
//   4. Grant access       → sessionStorage records role + garageCode
//
// PIN STORAGE (in Firestore garages/{garageCode}):
//   pins: { mechanic: "1234", admin: "5678", manager: "9012" }
//   Only a manager can write these via the Settings tab.
// =================================================================

export const ROLES = {
    MECHANIC: 'mechanic',
    ADMIN:    'admin',
    MANAGER:  'manager',
};

// What each role can do
export const PERMISSIONS = {
    mechanic: {
        viewJobCards:      true,
        viewActiveJobs:    true,
        viewCompletedJobs: true,
        createEntries:     false,
        viewReports:       false,
        viewClients:       false,
        viewFinancials:    false,   // index.html reports section
        accessManagement:  false,   // management.html entirely
        managePins:        false,
    },
    admin: {
        viewJobCards:      true,
        viewActiveJobs:    true,
        viewCompletedJobs: true,
        createEntries:     true,
        viewReports:       true,
        viewClients:       true,
        viewFinancials:    false,   // no financial figures
        accessManagement:  true,    // management.html (limited)
        managePins:        false,
    },
    manager: {
        viewJobCards:      true,
        viewActiveJobs:    true,
        viewCompletedJobs: true,
        createEntries:     true,
        viewReports:       true,
        viewClients:       true,
        viewFinancials:    true,
        accessManagement:  true,
        managePins:        true,
    },
};

// ─── Session helpers ──────────────────────────────────────────────

export function getSession() {
    return {
        garageCode: sessionStorage.getItem('garageCode') || '',
        role:       sessionStorage.getItem('userRole')   || '',
        authed:     sessionStorage.getItem('pinAuthed')  === 'true',
    };
}

export function setSession(garageCode, role) {
    sessionStorage.setItem('garageCode', garageCode.toUpperCase());
    sessionStorage.setItem('userRole',   role);
    sessionStorage.setItem('pinAuthed',  'true');
    sessionStorage.setItem('lastChecked', new Date().toDateString());
}

export function clearSession() {
    ['garageCode','userRole','pinAuthed','lastChecked',
     'subscriptionStatus','pendingGarageCode'].forEach(k => sessionStorage.removeItem(k));
}

export function can(permission) {
    const { role, authed } = getSession();
    if (!authed || !role) return false;
    return !!(PERMISSIONS[role]?.[permission]);
}

// ─── PIN verification (reads from Firestore) ─────────────────────

/**
 * Verify a PIN for a given garage + role.
 * @param {string}   garageCode
 * @param {string}   role        – 'mechanic' | 'admin' | 'manager'
 * @param {string}   pin         – user-entered PIN
 * @param {object}   db          – Firestore instance
 * @param {function} docFn       – Firestore `doc`
 * @param {function} getDocFn    – Firestore `getDoc`
 * @returns {Promise<{ok:boolean, garageData?:object, error?:string}>}
 */
export async function verifyPin(garageCode, role, pin, db, docFn, getDocFn) {
    if (!pin || pin.length < 4) return { ok: false, error: 'PIN must be at least 4 digits.' };

    try {
        const snap = await getDocFn(docFn(db, 'garages', garageCode.toUpperCase()));
        if (!snap.exists()) return { ok: false, error: 'Garage code not found.' };

        const data = snap.data();

        // Subscription gate
        const status = (data.subscriptionStatus || '').toLowerCase();
        if (status === 'inactive') return { ok: false, error: 'Subscription inactive. Please renew.' };
        if (status === 'trial') {
            const start = data.trialStartDate ? new Date(data.trialStartDate) : new Date();
            const days  = Math.floor((Date.now() - start) / 86400000);
            if (days > 14) return { ok: false, error: 'Free trial expired. Please subscribe.' };
        }

        const stored = (data.pins || {})[role];

        // If no PIN set for this role yet, allow first-time setup for manager only
        if (!stored) {
            if (role === ROLES.MANAGER && pin === '0000') {
                return { ok: true, garageData: data, firstSetup: true };
            }
            return { ok: false, error: `No PIN set for ${role}. Ask your manager to set one.` };
        }

        if (pin !== stored) return { ok: false, error: 'Incorrect PIN.' };

        return { ok: true, garageData: data };
    } catch (err) {
        console.error('[Auth] verifyPin error:', err);
        return { ok: false, error: 'Could not connect. Check your internet.' };
    }
}

/**
 * Save PIN(s) to Firestore. Manager role only.
 * @param {string}   garageCode
 * @param {object}   pins        – { mechanic?, admin?, manager? }
 * @param {object}   db
 * @param {function} docFn
 * @param {function} updateDocFn
 */
export async function savePins(garageCode, pins, db, docFn, updateDocFn) {
    const ref = docFn(db, 'garages', garageCode.toUpperCase());
    await updateDocFn(ref, { pins });
}

// ─── Trial banner ─────────────────────────────────────────────────

export function showTrialBanner(garageData) {
    if (document.getElementById('trial-banner')) return;
    if ((garageData.subscriptionStatus || '').toLowerCase() !== 'trial') return;
    const start = garageData.trialStartDate ? new Date(garageData.trialStartDate) : new Date();
    const daysLeft = 14 - Math.floor((Date.now() - start) / 86400000);
    if (daysLeft < 0) return;
    const b = document.createElement('div');
    b.id = 'trial-banner';
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#f59e0b;color:#1f2937;text-align:center;padding:8px;font-weight:bold;font-size:14px;';
    b.textContent = `⚠️ FREE TRIAL: ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining. Upgrade to keep access.`;
    document.body.prepend(b);
}
